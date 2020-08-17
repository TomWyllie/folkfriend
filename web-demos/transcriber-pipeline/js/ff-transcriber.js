// noinspection JSValidateTypes,JSUnresolvedVariable
window.AudioContext = window.AudioContext || window.webkitAudioContext;

function getAudioURLPipeline() {
    return new Pipeline([
        AudioURLNode
    ]);
}

class Pipeline {
    constructor(nodeClasses) {
        this.nodes = [null];    // Placeholder null entry
        for(let i = 0; i < nodeClasses.length; i++) {
            if(!(nodeClasses[i]) instanceof PipelineNode) {
                throw `Invalid node class ${nodeClasses[i]}`;
            }

            // Instantiate each node with its parent
            let parent = this.nodes[this.nodes.length - 1];
            this.nodes.push(new nodeClasses[i](parent));
        }

        // Remove the placeholder null entry
        this.nodes.splice(0, 1);

        // Ready all the nodes
        this.flush();

    }

    flush() {
        this.nodes.forEach(node => node.flush());
        this.finisher = this.nodes[this.nodes.length - 1].finisher;
        this.finish = this.nodes[0].finish;
    }

    input(input) {
        // Start at the beginning
        this.nodes[0].input(input);
    }
}

class PipelineNode {
    constructor(parentNode, queueMinSize=1, queueStride=1) {
        this.childNode = null;
        this.parentNode = parentNode;
        try {
            this.parentNode.childNode = this;
        } catch (e) {
            if(!(e instanceof TypeError)) {throw e;}
        }

        this.queueMinSize = queueMinSize;
        this.queueStride = queueStride;
    }

    flush() {
        // Flush any existing queued objects and reset ready for another set
        //  of original inputs.
        this.inputQueue = [];
        this.outputQueue = [];

        // In the pipeline class we can await this.finisher on the final node
        this.hasFinished = false;
        this.finisher = new Promise(resolve => {
            this.finish = () => {
                this.hasFinished = true;
                resolve();
            };
        });
    }

    inputValidator(input) {
        throw {name: "NotImplementedError"};
    }

    input(input) {
        if(this.hasFinished) {
            throw `Node has already finished`
        }

        // Input should be an array of objects
        if(!this.inputValidator(input)) {
            throw `Invalid input: ${input}`;
        }

        if(this.inputQueue.length) {
            this.inputQueue.push(...input);
        } else {
            // Saves us spreading when using URL -> [TensorFrequencyData]
            this.inputQueue = input;
        }

        this.propagate().catch(console.error);
    }

    async process(input) {
        // Perform some operation that takes in an array of objects
        //  that each conform to the check in inputValidator, of
        //  length queueMinSize, and outputs an array of objects
        throw {name: "NotImplementedError"};
    }

    async propagate() {
        // Propagate flow of data through the pipeline.

        if(this.inputQueue.length < this.queueMinSize) {
            // The first node in a online pipeline can never know if there
            //  will be any more inputs until finish() has been called.
            // Every other child node can work out whether or not it's
            //  finished based on its parent and itself.
            if(this.parentNode && this.parentNode.hasFinished) {
                this.finish();
            }
            return;
        }

        // Extract next slice of input
        const inputSlice = this.inputQueue.slice(0, this.queueMinSize);
        const result = await this.process(inputSlice);

        // Remove input
        this.inputQueue.splice(0, this.queueStride);

        // Only the last node will use the output queue but it is also
        //  useful when debugging.
        if(this.outputQueue.length) {
            this.outputQueue.push(...result);
        } else {
            // Saves us spreading when using URL -> [TensorFrequencyData]
            this.outputQueue = result;
        }

        if(this.childNode) {
            this.childNode.input(result);
        }
    }

}

class AudioURLNode extends PipelineNode {
    // Convert audio data from a given URL file into frequency data.
    //  TensorflowJS does more or less exactly this under the hood
    //  in iterators/microphone_iterator.ts, but with microphone
    //  data.

    constructor() {
        super();
    }

    inputValidator(input) {
        return (input.length === 1 && typeof input[0] === "string");
    }

    async process(input) {
        const url = input[0];

        // Get duration of audio file
        const audio = new Audio();
        audio.src = url;
        await new Promise(resolve => {audio.onloadedmetadata = resolve});
        const offlineNumSamples = audio.duration * FFConfig.SAMPLE_RATE;
        audio.removeAttribute('src'); // Don't yet load in the rest of the file

        // Create WebAudio objects
        const audioContext = new OfflineAudioContext(1, offlineNumSamples, FFConfig.SAMPLE_RATE);
        const source = audioContext.createBufferSource();
        const analyser = audioContext.createAnalyser();
        const processor = audioContext.createScriptProcessor(FFConfig.SPEC_WINDOW_SIZE, 1, 1);

        // Load data into source
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        source.buffer = await audioContext.decodeAudioData(arrayBuffer);

        let result = [];

        // Connect things up
        source.connect(analyser);
        processor.connect(audioContext.destination);
        const frequencyData = new Float32Array(analyser.frequencyBinCount);
        // noinspection JSDeprecatedSymbols
        processor.onaudioprocess = () => {
            analyser.getFloatFrequencyData(frequencyData)
            // console.debug(frequencyData);
            result.push(tf.tensor(frequencyData.slice(0)));
        };

        audioContext.oncomplete = this.finish;
        source.start(0);
        await audioContext.startRendering();

        return result;
    }
}
