// noinspection JSValidateTypes,JSUnresolvedVariable
window.AudioContext = window.AudioContext || window.webkitAudioContext;

function getAudioURLPipeline() {
    return new Pipeline([
        AudioURLNode,
        AutocorrelationNode
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

    get outputQueue() {
        return this.nodes[this.nodes.length - 1].outputQueue;
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

        if(!this.queueStride) {
            throw `Invalid queue stride ${this.queueStride}`
        }
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
        const initialLength = this.inputQueue.length;

        while(this.canProceed) {

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

        // The first node in a online pipeline can never know if there
        //  will be any more inputs until finish() has been called.
        // Every other child node can work out whether or not it's
        //  finished based on its parent and itself.
        if(this.parentNode && this.parentNode.hasFinished) {
            this.finish();
        }
    }

    get canProceed() {
        return (this.inputQueue.length && this.inputQueue.length >= this.queueMinSize)
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
        const analyser = new AnalyserNode(audioContext, {fftSize: FFConfig.SPEC_WINDOW_SIZE, smoothingTimeConstant: 0});
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

    // TODO investigate using decibels as range compression rather than raising to a power.
    //  it would make some steps in this node redundant and save compute.

    constructor(parent) {
        super(parent);

        // Corresponds to k = 1/3. See process().
        this.kFactor = Math.log(Math.cbrt(10)) / 20;

        this.interpMatrix = null;
    }

    inputValidator(input) {
        for(let i = 0; i < input.length; i++) {
            if(input[i].constructor.name !== "t" || input[i].size !== FFConfig.SPEC_WINDOW_SIZE / 2) {
                return false
            }
        }
        return true;
    }

    async process(input) {
        let frame = input[0];

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
        //  and we've scaled the absolute value of each real-imaginary
        //  with a power of 1/3.

        frame = tf.real(tf.spectral.rfft(frame));
        frame = tf.maximum(frame, 0);

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

        return [tf.matMul(frame, this.interpMatrix)];
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