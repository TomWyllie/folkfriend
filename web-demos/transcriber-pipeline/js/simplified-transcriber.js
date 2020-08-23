class Transcriber {
    constructor() {
        this.flush();
        this.model = null;
    }

    flush() {
        this.freqDataQueue = [];
        this.framesQueue = [];
        this.midis = [];
        this.frameIndex = 0;

        this.proceedRequests = 0;
        this.proceeding = false;

        this.closed = false;
        this.finished = new Promise(resolve => {
            this.finish = resolve;
        });
    }

    async initialise() {
        console.time("transcriber-init");

        this.audioDSP = new AudioDSP();
        await this.audioDSP.ready;

        await tf.ready();
        this.model = await tf.loadLayersModel("models/cnn/model.json");

        // Only necessary if we're compiling shaders (ie WebGL backend)
        let warmupResult = this.model.predict(tf.zeros([1, FFConfig.CONTEXT_FRAMES, FFConfig.SPEC_NUM_BINS, 1]));
        await warmupResult.data();
        warmupResult.dispose();

        // Corresponds to k = 1/3. See process().
        this.kFactor = Math.log(Math.cbrt(10)) / 20;
        this.interpMatrix = this.getInterpMatrix();

        console.timeEnd("transcriber-init");
    }

    getInterpMatrix() {
        // Resample to linearly spaced (in musical notes)
        const frameSize = 1 + Math.floor(FFConfig.SPEC_WINDOW_SIZE / 2);
        const binMidiValues = binsTensorToMidis(tf.range(1, frameSize));

        // There is no 1D interpolation built into TF-JS (as of 2.1.0) but we
        //  can quite easily represent it as a matrix operation.
        return computeInterpMatrix(binMidiValues);
    }

    async urlToFreqData(url) {

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

        // Connect things up
        source.connect(analyser);
        processor.connect(audioContext.destination);
        const frequencyData = new Float32Array(analyser.frequencyBinCount);
        // noinspection JSDeprecatedSymbols
        processor.onaudioprocess = () => {
            analyser.getFloatFrequencyData(frequencyData);
            // console.debug(frequencyData);
            this.freqDataQueue.push(frequencyData.slice(0));
        };

        source.start(0);
        await audioContext.startRendering();
    }

    freqDataToFrame(freqData) {
        return this.audioDSP.processFreqData(freqData);
    }

    async bulkProceed() {
        // Proceed up until the end of all provided data.
        return this.proceed(this.framesQueue.length + this.freqDataQueue.length);
    }

    async proceed(numProceedRequests=1) {
        // Now wait for all processing to catch up. BUT whilst this is
        //  happening another input may well asynchronously come in.
        //  we don't want to have multiple calls running simultaneously
        //  so block any further processing until caught up.

        // Queue up requests for the future (even if it is one that is executed immediately)
        this.proceedRequests += numProceedRequests;

        if(!this.proceeding) {
            // Handle the request
            this.proceeding = true;

            // This has to be a while loop, because as we process
            //  a request that came through as we were just propagating,
            //  another request could come through, ad infinitum
            while(this.proceedRequests > 0) {
                await this.process();
                this.proceedRequests--;
            }
            this.proceeding = false
        }
    }

    async process() {
        // Proceed as much as possible. Start by converting all raw
        //  frequency data into frames to be used by the CNN.
        while(this.freqDataQueue.length) {
            this.framesQueue.push(
                tf.tensor(
                    this.freqDataToFrame(
                        this.freqDataQueue.shift()
                    )
                )
            );
        }

        let framesToTheRight = this.framesQueue.length - this.frameIndex;
        let padding = FFConfig.CONTEXT_FRAMES / 2;

        if(!this.closed && framesToTheRight < FFConfig.CONTEXT_FRAMES) {
            return;
        }

        let paddingLeft = Math.max(0, padding - this.frameIndex);
        let paddingRight = Math.max(0, padding - framesToTheRight);

        let hi = Math.min(this.frameIndex + padding, this.framesQueue.length);
        let lo = Math.max(this.frameIndex - padding, 0);

        let dataFrames = this.framesQueue.slice(lo, hi);
        let cnnInput = tf.stack(dataFrames);

        if(lo === this.frameIndex - padding) {
            // We can safely dispose this frame as it will not be reused.
            this.framesQueue[lo].dispose();
        }

        if(paddingLeft || paddingRight) {
            // Pad
            cnnInput = tf.pad(cnnInput, [[paddingLeft, paddingRight], [0, 0]])
        }

        cnnInput = tf.expandDims(tf.expandDims(cnnInput, 2));
        let prediction = tf.squeeze(this.model.predict(cnnInput, {batchSize: 1}));
        cnnInput.dispose();

        let frameFeats = tf.reshape(this.framesQueue[this.frameIndex], [FFConfig.MIDI_NUM, FFConfig.SPEC_BINS_PER_MIDI]);
        frameFeats = tf.sum(frameFeats, 1);
        let denoised = tf.mul(frameFeats, prediction);
        frameFeats.dispose();
        prediction.dispose();

        let midiNote = await tf.argMax(denoised).data();
        denoised.dispose();

        this.midis.push(midiNote);

        this.frameIndex++;

        if(this.closed && this.frameIndex === this.framesQueue.length) {
            this.finish();
        }
    }
}

function computeInterpMatrix(midiValues) {
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