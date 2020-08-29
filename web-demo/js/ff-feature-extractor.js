class FeatureExtractor {
    constructor() {

        this.flush();
        this.cnnBatchSize = 32;

        // We have to normalise each batch by something as the CNN is
        //  sensitive to magnitude of input values.

        //  If we normalise each batch to the range [0, 1] then depending
        //  on the batch size we may be boosting up the volume of a very
        //  quiet part of audio, and in doing so adding noise to results.
        //  In python we like to normalise by the maximum value of the
        //  whole spectrogram, but we can't know this maximum until the
        //  last frame has finished processing, so to retain causality we
        //  keep a running maximum of the past few frames. This means we
        //  are normalising over a much larger section of time and thus
        //  less sensitive to rapid variations in magnitude. (this is
        //  a simple low pass filter on the maximum value of each batch).

        // Batch size 8, contextFrames 10 => 18 frame normalisation width. (0.36s)
        //  with this, 120 + 10 contextFrames => 128 frame normalisation width. (2.56s)
        this.cnnRunningMaxNumFrames = 120;
        this.cnnRunningMaxNumBatches = this.cnnRunningMaxNumFrames / this.cnnBatchSize;

        this.model = null;
    }

    flush() {
        this.freqDataQueue = [];
        this.framesQueue = [];
        this.cnnBatchQueue = [];
        this.midis = [];
        this.midiEnergies = [];
        this.frameIndex = 0;

        this.proceedRequests = 0;
        this.proceeding = false;

        this.cnnRunningMaxBatches = [];

        this.closed = false;
        this.finished = new Promise(resolve => {
            this.finish = resolve;
        });

        // Debugging
        if(FFDebug) {
            this.debugDenoised = [];
        }
    }

    async initialise() {
        console.time("feature-extractor-init");

        this.audioDSP = new AudioDSP();
        await this.audioDSP.ready;

        await tf.ready();
        this.model = await tf.loadLayersModel("external/models/uint8/model.json");

        // Only necessary if we're compiling shaders (ie WebGL backend)
        tf.tidy(() => {
            return this.model.predict(tf.zeros([1, FFConfig.CONTEXT_FRAMES, FFConfig.SPEC_NUM_BINS, 1]));
        }).dispose();

        console.timeEnd("feature-extractor-init");
    }

    async urlToFreqData(url) {
        // Track how long audio takes across network
        //  so we can actually measure performance
        const t0 = performance.now();

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

        this.networkPerf = performance.now() - t0;

        await audioContext.startRendering();
    }

    freqDataToFrame(freqData) {
        return this.audioDSP.processFreqData(freqData);
    }

    cleanup() {
        this.cnnRunningMaxBatches.forEach(t => t.dispose());
        const mem = tf.memory();
        if(mem.numTensors > 10) {
            console.warn("Unexpectedly many tensors remain allocated at end of transcription");
            console.warn(mem);
        }
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

        tf.engine().startScope();

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

        tf.engine().endScope();
    }

    async process() {
        // Proceed as much as possible. Start by converting all raw
        //  frequency data into frames to be used by the CNN.
        while(this.freqDataQueue.length) {
            this.framesQueue.push(
                this.freqDataToFrame(
                    this.freqDataQueue.shift()
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

        let cnnInput = tf.tidy(() => {
            let dataFrames = this.framesQueue.slice(lo, hi);
            for(let i = 0; i < dataFrames.length; i++) {
                dataFrames[i] = tf.tensor(dataFrames[i]);
            }
            let cnnInput = tf.stack(dataFrames);
            if(paddingLeft || paddingRight) {
                // Pad
                cnnInput = tf.pad(cnnInput, [[paddingLeft, paddingRight], [0, 0]])
            }
            return tf.expandDims(cnnInput, 2);
        })

        // if(lo === this.frameIndex - padding) {
        //     // We can safely dispose this frame as it will not be reused.
        //     this.framesQueue[lo].dispose();
        // }

        this.frameIndex++;
        this.cnnBatchQueue.push(cnnInput);

        if (!(this.cnnBatchQueue.length >= this.cnnBatchSize || (this.closed && this.frameIndex === this.framesQueue.length))) {
            return;
        }

        let cnnBatchArray = this.cnnBatchQueue.splice(0, this.cnnBatchSize);

        const denoised = tf.tidy(() => {

            let cnnBatch = tf.stack(cnnBatchArray);
            cnnBatchArray.forEach(paddedFrame => {
                paddedFrame.dispose()
            });

            // See explanation in constructor for the sliding window
            // normalisation value explanation.
            let batchMax = tf.max(cnnBatch);
            tf.keep(batchMax);  // Don't dispose of it yet
            this.cnnRunningMaxBatches.push(batchMax);

            if (this.cnnRunningMaxBatches.length > this.cnnRunningMaxNumBatches) {
                this.cnnRunningMaxBatches[0].dispose();
                this.cnnRunningMaxBatches.shift();
            }

            let lowPassBatchMax = this.cnnRunningMaxBatches.reduce(
                (a, b) => tf.maximum(a, b)
            );

            // divNoNan is important here. Otherwise we get NaN.
            cnnBatch = tf.divNoNan(cnnBatch, lowPassBatchMax);

            let prediction = tf.squeeze(this.model.predict(cnnBatch, {batchSize: cnnBatch.shape[0]}));
            let centreFrame = tf.squeeze(tf.slice(cnnBatch, [0, FFConfig.CONTEXT_FRAMES / 2, 0, 0], [-1, 1, -1, -1]));
            cnnBatch.dispose();

            centreFrame = tf.reshape(centreFrame, [-1, FFConfig.MIDI_NUM, FFConfig.SPEC_BINS_PER_MIDI]);
            centreFrame = tf.sum(centreFrame, 2);
            let denoised = tf.mul(centreFrame, prediction);
            centreFrame.dispose();
            prediction.dispose();

            //  TODO use this once it's been written in TF-JS...
            //      https://js.tensorflow.org/api/latest/#topk
            // const {midiEnergies, midiNotes} = tf.topk(denoised, 1);
            let midiEnergies = tf.max(denoised, 1);
            let midiNotes = tf.argMax(denoised, 1);

            return {notes: midiNotes, energies: midiEnergies};
        });

        let midiEnergyData = await denoised.energies.data();
        let midiNoteData = await denoised.notes.data();
        if(FFDebug) {
            this.debugDenoised.push(denoised);
        } else {
            denoised.energies.dispose();
            denoised.notes.dispose();
        }

        for(let i = 0; i < midiEnergyData.length; i++) {
            // Recall the frequency is descending with index, so
            //  argmax indices in the reverse order. We want low values
            //  to correspond to low notes, for the decoder.
            midiNoteData[i] = FFConfig.MIDI_NUM - midiNoteData[i] - 1;
        }

        this.midis.push(...midiNoteData);
        this.midiEnergies.push(...midiEnergyData);

        if(this.closed && this.midis.length === this.framesQueue.length) {
            this.cleanup();
            this.finish();
        }
    }
}
