// noinspection JSValidateTypes,JSUnresolvedVariable
window.AudioContext = window.AudioContext || window.webkitAudioContext;

async function getAudioURLPipeline() {
    await tf.ready();
    return new Pipeline([
        AudioURLNode,
        AutocorrelationNode,
        CNNPadNode,
        // CNNNode,
        // RNNNode
    ]);
}

class Pipeline {
    constructor(nodeClasses) {
        this.nodes = [null];    // Placeholder null entry
        for (let i = 0; i < nodeClasses.length; i++) {
            if (!(nodeClasses[i]) instanceof PipelineNode) {
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

    input(input) {
        this.nodes[0].input(input);
        this.propagate().catch(console.error);
    }

    async propagate() {
        // Now wait for all the nodes to catch up. BUT whilst this is
        //  happening another input may well asynchronously come in.
        //  we don't want to have multiple calls to the same pipeline
        //  object running simultaneously so block any further
        //  processing until the last node is caught up with this input.

        // Queue up a request for the future (even if it is executed immediately)
        this.propagateRequests++;

        if(!this.propagating) {
            // Handle the request
            this.propagating = true;

            // This has to be a while loop, because as we process
            //  a request that came through as we were just propagating,
            //  another request could come through, ad infinitum
            while(this.propagateRequests > 0) {
                for(let i = 0; i < this.nodes.length; i++) {
                    await this.nodes[i].proceed();
                }
                this.propagateRequests--;
            }
            this.propagating = false

        }
    }

    flush() {
        this.propagating = false;
        this.propagateRequests = 0;
        this.nodes.forEach(node => node.flush());
    }

    finish() {
        this.nodes[0].finish();
    }

    get finished() {
        return this.nodes[this.nodes.length - 1].finished;
    }

}

class PipelineNode {
    constructor(parentNode) {
        this.childNode = null;
        this.parentNode = parentNode;
        this.parentNode.childNode = this;
    }

    flush() {
        // Flush any existing queued objects and reset ready for another set
        //  of original inputs.
        this.outputQueue = [];
        this.processedItems = 0;

        /*
          this.finish:      function that tells this node that it's parent's
                              outputQueue will not be updated any further

          this.finished:    promise that resolves once this node will no longer
                              update its outputQueue

          this.hasFinished: boolean indicating whether or not this.finished
                              has resolved
        */

        this.hasFinished = false;
        this.finished = new Promise(resolve => {
            this.finish = () => {
                console.debug(`${this.constructor.name} is finishing`);
                this.onFinish();
                this.hasFinished = true;
                resolve();
            };
        });
    }

    onFinish() {
        // Implemented by sub-classes
    }

    async proceed() {
        /* Proceed as much as possible */
        if(this.hasFinished) {
            console.warn(new Error().stack);
            console.warn(`Node ${this.constructor.name} has already finished`);
            return;
        }

        await this.process();

        if(this.parentNode && this.parentNode.hasFinished &&
            this.processedItems === this.parentNode.outputQueue.length) {
            // Then this node is finished.
            this.finish();
        }
    }

    async process(input) {
        // Perform some operation that takes in an array of objects
        //  that each conform to the check in inputValidator, of
        //  length queueMinSize, and outputs an array of objects
        throw {name: "NotImplementedError"};
    }
}

class PipelineInputNode extends PipelineNode {
    constructor() {
        super({});
        this.inputQueue = [];
    }

    input(input) {
        this.inputQueue.push(...input);
    }

    flush() {
        super.flush();
        this.inputQueue = [];
    }
}

class AudioURLNode extends PipelineInputNode {
    // Convert audio data from a given URL file into frequency data.
    //  TensorflowJS does more or less exactly this under the hood
    //  in iterators/microphone_iterator.ts, but with microphone
    //  data.

    constructor() {
        super();
    }

    async process() {
        // Although the AudioURLNode should really only take
        //  one URL before calling pipeline.finish() and
        //  the pipeline being flushed.
        if(this.processedItems >= this.inputQueue.length) {
            return;
        }

        const inputURL = this.inputQueue[this.processedItems];
        this.processedItems++;

        // Get duration of audio file
        const audio = new Audio();
        audio.src = inputURL;
        await new Promise(resolve => {audio.onloadedmetadata = resolve});
        const offlineNumSamples = audio.duration * FFConfig.SAMPLE_RATE;
        audio.removeAttribute('src'); // Don't yet load in the rest of the file

        // Create WebAudio objects
        const audioContext = new OfflineAudioContext(1, offlineNumSamples, FFConfig.SAMPLE_RATE);
        const source = audioContext.createBufferSource();
        const analyser = new AnalyserNode(audioContext, {fftSize: FFConfig.SPEC_WINDOW_SIZE, smoothingTimeConstant: 0});
        const processor = audioContext.createScriptProcessor(FFConfig.SPEC_WINDOW_SIZE, 1, 1);

        // Load data into source
        const response = await fetch(inputURL);
        const arrayBuffer = await response.arrayBuffer();
        source.buffer = await audioContext.decodeAudioData(arrayBuffer);

        // Connect things up
        source.connect(analyser);
        processor.connect(audioContext.destination);
        const frequencyData = new Float32Array(analyser.frequencyBinCount);
        // noinspection JSDeprecatedSymbols
        processor.onaudioprocess = () => {
            analyser.getFloatFrequencyData(frequencyData)
            // console.debug(frequencyData);
            this.outputQueue.push(tf.tensor(frequencyData.slice(0)));
        };

        source.start(0);
        await audioContext.startRendering();
    }
}

class AutocorrelationNode extends PipelineNode {
    // The frequency data from AudioURLNode or AudioMicrophoneNode is
    //  raw Float32 FFT data in tensors. BUT this data is in decibels
    //  and has also been "absolute valued" already.
    //  See https://www.w3.org/TR/webaudio/#fft-windowing-and-smoothing-over-time

    // The absolute value part isn't clear (you might be left wondering where
    //  the imaginary part goes!) but note the equation:
    //          Then the smoothed value, X^[k], is computed by
    //              X^[k] = \tau X^−1[k] + (1 − \tau) |X[k]|

    //  If we set smoothing constant (\tau) to zero then the data in each
    //  tensor is just the magnitude |X[k]|.

    constructor(parent) {
        super(parent);

        // Corresponds to k = 1/3. See process().
        this.kFactor = Math.log(Math.cbrt(10)) / 20;
        this.interpMatrix = null;
    }

    async process() {
        let numInputs = this.parentNode.outputQueue.length;
        for(let i = this.processedItems; i < numInputs; i++) {
            let frame = this.parentNode.outputQueue[i];

            // Maths incoming...

            // Decimal -> Decibel conversion is 20 * log10(x)
            // So we want to do 10^(x/20)
            // But remember we are using a "k" value (see ff_config.py) of 1/3.
            // So we want to do
            //      (10^(x/20))^(1/3)
            //  Which is equal to
            //      cbrt(10)^(x/20)
            //  Except TF only gives us exp(), So all together we need to use
            //      (e^ln(cbrt(10)))^(x/20)
            //    = exp( x * ln(cbrt(10))/20 )

            frame = tf.exp(tf.mul(frame, this.kFactor));

            // Also, browser FFT implementation halves length of signal
            //  (it only returns one of the two symmetrical sides; FFT of
            //  a real signal is always conjugate-symmetric ie X[-k] = X[k]*
            //  and browser audio data must always be real)

            frame = tf.concat([frame, tf.expandDims(frame.min()), tf.reverse(tf.slice(frame, 1))]);

            // So now frame is now a 1024 long FFT of a 1024-sample window,
            //  and we've scaled the absolute value of each complex value
            //  with a power of 1/3.

            let webAssemblyDebugging = false;

            if(webAssemblyDebugging) {
                // Pretend FFT. Gets shape right so can proceed.
                frame = tf.expandDims(frame);
                frame = tf.slice(frame, 513);
            } else {
                frame = tf.real(tf.spectral.rfft(frame));
                frame = tf.maximum(frame, 0);
            }

            // Now frame is 513 long
            //  (https://docs.scipy.org/doc/scipy/reference/generated/scipy.fft.rfft.html)

            // Remove DC bin as it has frequency = 0 = midi note -infinity.
            frame = tf.slice(frame, [0, 1]);  // remove first bin

            if(this.interpMatrix === null) {
                // Resample to linearly spaced (in musical notes)
                const binMidiValues = binsTensorToMidis(tf.range(1, frame.size + 1));

                // There is no 1D interpolation built into TF-JS (as of 2.1.0) but we
                //  can quite easily represent it as a matrix operation.
                this.interpMatrix = getInterpMatrix(binMidiValues);
            }

            this.outputQueue.push(tf.matMul(frame, this.interpMatrix));
        }
        this.processedItems = numInputs;
    }
}

class CNNPadNode extends PipelineNode {
    async process() {
        let q = this.parentNode.outputQueue;
        let n = q.length;
        let context = FFConfig.CONTEXT_FRAMES;
        let padding = context / 2;

        if(n < padding) {
            // Need more frames
            return;
        }

        for(let i = this.processedItems; i < n; i++) {

            let paddedFrame;
            let rightEdge = this.processedItems + padding > n;

            if(this.processedItems < padding) {
                // We have not yet processed enough frames to no longer require
                //  any padding. So we require some padding.

                const numZeroFrames = context - this.processedItems;
                const unpadded = tf.concat(q.slice(0, padding + this.processedItems))
                paddedFrame = tf.pad(unpadded, [[0, 0], [0, 0]]);

                console.debug(1);
            } else if(!rightEdge) {
                // We're not too close to the right edge or the left edge.
                //  No padding will be applied.

                // No padding case
                paddedFrame = tf.concat(q.slice(this.processedItems - padding, this.processedItems + padding));
                console.debug(2);

            } else if(this.parentNode.hasFinished) {
                // Parent finished but we're close to the right edge, add padding to the right edge.
                console.debug(3);

                const numZeroFrames = n + padding - this.processedItems;
                const unpadded = tf.concat(q.slice(this.processedItems - padding, n));
                paddedFrame = tf.pad(unpadded, [[0, 0], [0, 0]]);
            } else {
                // We've reached as far as we can. We need more data on the queue
                //  to proceed further.
                return;
            }

            console.debug(paddedFrame.shape);

            this.outputQueue.push(paddedFrame);
            this.processedItems++;
        }
    }
}

class CNNNode extends PipelineNode {
    constructor(parent) {
        super(parent, FFConfig.CONTEXT_FRAMES, 1);
        this.modelLoaded = this.loadModel();

        // We need to tell the parent node of this node to pass in the
        //  edge padding as it finishes, to pad our data on the right
        //  hand side.
        parent.onFinish = () => {
            this.input(this.edgePadding());
        }
    }

    flush() {
        super.flush();

        // Add edge padding on left side
        this.inputQueue = this.edgePadding();
    }

    edgePadding() {
        // But we pad the input buffer with zeros so we don't lose any frames
        const zeroFrame = tf.zeros([1, FFConfig.SPEC_NUM_BINS], 'float32');
        let zeroFrames = new Array(FFConfig.CONTEXT_FRAMES / 2)
        zeroFrames.fill(zeroFrame);
        return zeroFrames;
    }

    async loadModel() {
        this.model = await tf.loadLayersModel("models/cnn/model.json");
    }

    async process(input) {
        await this.modelLoaded;

        let batch = tf.expandDims(tf.expandDims(tf.concat2d(input)), 3);
        batch = tf.div(batch, tf.max(batch));
        let prediction = this.model.predict(batch);

        // Instead of scaling up the prediction, we scale down the original
        //  input, resulting in fewer operations. But this makes the output
        //  less visually intuitive so for debugging the code to return the
        //  prediction only is kept below.

        // 1 bin per midi note -> BINS_PER_MIDI bins per midi note
        // prediction = tf.squeeze(prediction);
        // prediction = prediction.reshape([prediction.size, 1]);
        // prediction = tf.tile(prediction, [1, FFConfig.SPEC_BINS_PER_MIDI]);
        // prediction = prediction.reshape([1, FFConfig.SPEC_NUM_BINS]);
        // return [prediction];

        // Extract the central frame that the prediction corresponds to
        let centralFrame = input[FFConfig.CONTEXT_FRAMES / 2];
        centralFrame = tf.reshape(centralFrame, [1, FFConfig.MIDI_NUM, FFConfig.SPEC_BINS_PER_MIDI]);
        centralFrame = tf.sum(centralFrame, 2);

        const denoisedFrame = tf.mul(centralFrame, prediction);
        return [denoisedFrame];
    }
}

class RNNNode extends PipelineNode {
    constructor(parent) {
        super(parent, FFConfig.SPEC_NUM_FRAMES, FFConfig.SPEC_NUM_FRAMES);
        this.modelLoaded = this.loadModel();
    }

    async loadModel() {
        this.model = await tf.loadLayersModel("models/rnn/model.json");
    }

    greedyDecoder(prediction) {
        // Greedy decode RNN predictions to melody contour
        let argMaxes = tf.argMax(prediction, 2).squeeze();

        console.debug(argMaxes.dataSync());
    }

    async process(input) {
        await this.modelLoaded;

        let batch = tf.expandDims(tf.concat2d(input));
        // batch = tf.div(batch, tf.max(batch));
        batch = tf.mul(batch, tf.div(255, tf.max(batch)));
        let prediction = this.model.predict(batch);
        prediction = tf.sub(prediction, tf.min(prediction));

        this.greedyDecoder(prediction);

        return [prediction];
    }
}

function getInterpMatrix(midiValues) {
    /*
        Let LMB = FFConfig.LINEAR_MIDI_BINS.size

        [<-- frame.size -->] [<-      LMB       ->]   /\
                             |                    |
                             |                    |  frame.size
                             |                    |
                             [                    ]   \/

        Frame: 1x512            Interp: 512xLMB

        Result: 1xLMB

     */

    const lmb = FFConfig.LINEAR_MIDI_BINS.length;
    const interpData = new Float32Array(midiValues.size * lmb);

    const nonLinearBins = midiValues.dataSync();

    for(let i = 0; i < lmb; i++) {
        // Each linear midi bin is a linear combination of two bins from
        //  the spectrogram
        const linearBinMidiValue = FFConfig.LINEAR_MIDI_BINS[i];

        if(linearBinMidiValue < nonLinearBins[nonLinearBins.length - 2]) {
            throw "Linear bin goes too low";
        }

        // Note both arrays are monotonically decreasing in value
        let lo = 0;
        for(let j = 0; j < nonLinearBins.length; j++) {
            if(linearBinMidiValue > nonLinearBins[j]) {
                lo = j;
                break;
            }
        }

        let delta = nonLinearBins[lo - 1] - nonLinearBins[lo];
        let x1 = (nonLinearBins[lo - 1] - linearBinMidiValue) / delta;
        let x2 = -(nonLinearBins[lo] - linearBinMidiValue) / delta;

        if(x1 > 1 || x1 < 0 || x2 > 1 || x2 < 0) {
            throw `Invalid x1: ${x1}, x2: ${x2}`;
        }

        interpData[i * nonLinearBins.length + lo] = x1;
        interpData[i * nonLinearBins.length + lo - 1] = x2;
    }

    return tf.transpose(tf.tensor2d(interpData, [lmb, midiValues.size]));
}

function binsTensorToMidis(indices) {
    // Convert frequency bins into MIDI notes, according to equation
    // {midi notes relative to A4} = log_base[2^1/12](frequency / 440Hz)
    //  and                   freq = sampleRate / index
    // Which simplifies to midi note values of autocorrelation index =
    //  69 + log_base[2^1/12](index / 440)
    return tf.add(69, tf.div(tf.log(tf.div(FFConfig.SAMPLE_RATE / 440.0, indices)), Math.log(Math.pow(2, 1/12.))));
}