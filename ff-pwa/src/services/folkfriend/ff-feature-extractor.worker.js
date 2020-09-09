/* This is the only place we need Tensorflow. */
// https://www.npmjs.com/package/@tensorflow/tfjs-backend-wasm

// Import @tensorflow/tfjs or @tensorflow/tfjs-core
import * as tf from '@tensorflow/tfjs';

// Adds the WASM backend to the global backend registry.
import '@tensorflow/tfjs-backend-wasm';

// https://github.com/tensorflow/tfjs/tree/master/tfjs-backend-wasm/starter/webpack
import {setWasmPath} from '@tensorflow/tfjs-backend-wasm';

setWasmPath('http://localhost:8080/tf/tfjs-backend-wasm.wasm');
// import wasmPath from '../../../node_modules/@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm';

// Set the backend to WASM and wait for the module to be ready.
const backendSet = tf.setBackend('wasm');

import FFConfig from "@/services/folkfriend/ff-config";
import audioDSP from "@/services/folkfriend/ff-dsp";

class FeatureExtractor {
    constructor(rootURL = "") {
        this.rootURL = rootURL;

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

        this.ready = this.initialise().then();
    }

    flush() {
        this.freqDataQueue = [];
        this.framesQueue = [];
        this.cnnBatchQueue = [];
        this.denoisedFramesSparse = [];
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
        if (FFConfig.debug) {
            this.debugDenoised = [];
        }
    }

    async initialise() {
        console.time("feature-extractor-init");

        this.audioDSP = audioDSP;

        await backendSet;
        await tf.ready();
        this.model = await tf.loadLayersModel(`models/uint8/model.json`);

        // Only necessary if we're compiling shaders (ie WebGL backend)
        // tf.tidy(() => {
        //     return this.model.predict(tf.zeros([1, FFConfig.CONTEXT_FRAMES, FFConfig.SPEC_NUM_BINS, 1]));
        // }).dispose();

        console.timeEnd("feature-extractor-init");
    }

    async freqDataToFrame(freqData) {
        return await this.audioDSP.processFreqData(freqData);
    }

    cleanup() {
        this.cnnRunningMaxBatches.forEach(t => t.dispose());
        const mem = tf.memory();
        if (mem.numTensors > 10) {
            console.warn("Unexpectedly many tensors remain allocated at end of transcription");
            console.warn(mem);
        }
    }

    async bulkProceed() {
        // Proceed up until the end of all provided data.
        return this.proceed(this.framesQueue.length + this.freqDataQueue.length);
    }

    async proceed(numProceedRequests = 1) {
        // Now wait for all processing to catch up. BUT whilst this is
        //  happening another input may well asynchronously come in.
        //  we don't want to have multiple calls running simultaneously
        //  so block any further processing until caught up.

        // Catch any requests made before things have loaded in
        await this.ready;

        // Queue up requests for the future (even if it is one that is executed immediately)
        this.proceedRequests += numProceedRequests;

        tf.engine().startScope();

        if (!this.proceeding) {
            // Handle the request
            this.proceeding = true;

            // This has to be a while loop, because as we process
            //  a request that came through as we were just propagating,
            //  another request could come through, ad infinitum
            while (this.proceedRequests > 0) {
                await this.process();
                this.proceedRequests--;
            }
            this.proceeding = false;
        }

        tf.engine().endScope();
    }

    async process() {
        // Proceed as much as possible. Start by converting all raw
        //  frequency data into frames to be used by the CNN.
        while (this.freqDataQueue.length) {
            const frame = await this.freqDataToFrame(this.freqDataQueue.shift());
            this.framesQueue.push(frame);
        }

        let framesToTheRight = this.framesQueue.length - this.frameIndex;
        let padding = FFConfig.CONTEXT_FRAMES / 2;

        if (!this.closed && framesToTheRight < FFConfig.CONTEXT_FRAMES) {
            return;
        }

        let paddingLeft = Math.max(0, padding - this.frameIndex);
        let paddingRight = Math.max(0, padding - framesToTheRight);

        let hi = Math.min(this.frameIndex + padding, this.framesQueue.length);
        let lo = Math.max(this.frameIndex - padding, 0);

        let cnnInput = tf.tidy(() => {
            let dataFrames = this.framesQueue.slice(lo, hi);
            for (let i = 0; i < dataFrames.length; i++) {
                dataFrames[i] = tf.tensor(dataFrames[i]);
            }
            let cnnInput = tf.stack(dataFrames);
            if (paddingLeft || paddingRight) {
                // Pad
                cnnInput = tf.pad(cnnInput, [[paddingLeft, paddingRight], [0, 0]]);
            }
            return tf.expandDims(cnnInput, 2);
        });

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
                paddedFrame.dispose();
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

            if (FFConfig.debug) {
                tf.keep(denoised);
                this.debugDenoised.push(denoised);
            }

            //  TODO use this once it's been written in TF-JS...
            //      https://js.tensorflow.org/api/latest/#topk
            // const {midiEnergies, midiNotes} = tf.topk(denoised, 1);
            return denoised;
        });

        let denoisedData = await denoised.data();

        if (!FFConfig.debug) {
            denoised.dispose();
        }

        // for(let i = 0; i < midiEnergyData.length; i++) {
        // Recall the frequency is descending with index, so
        //  argmax indices in the reverse order. We want low values
        //  to correspond to low notes, for the decoder.
        // midiNoteData[i] = FFConfig.MIDI_NUM - midiNoteData[i] - 1;
        // }

        // Sparsify the data at each frame
        for (let i = 0; i < denoisedData.length; i += FFConfig.MIDI_NUM) {
            let sparseIndices = topK(denoisedData.slice(i, i + FFConfig.MIDI_NUM), 5);
            this.denoisedFramesSparse.push(sparseIndices);
        }

        if (this.closed && this.denoisedFramesSparse.length === this.framesQueue.length) {
            this.cleanup();
            this.finish();
        }
    }

    async getDenoisedFramesSparse() {
        return this.denoisedFramesSparse;
    }
}

function topK(inp, count, flip = true) {
    if (flip) {
        // Remember that previously as we increased the index the
        //  frequency descended. But now we want index 0 to correspond
        //  to the lowest midi note.
        inp = inp.reverse();
    }

    let indices = [];
    for (let i = 0; i < inp.length; i++) {
        indices.push(i); // add index to output array
        if (indices.length > count) {
            indices.sort(function (a, b) {
                return inp[b] - inp[a];
            }); // descending sort the output array
            indices.pop(); // remove the last index (index of smallest element in output array)
        }
    }
    let sparse = {};
    sparse[indices[0]] = inp[indices[0]];
    for (let i = 1; i < count; i++) {
        // Make sure any value we add is at least 5% of the maximum.
        //  Otherwise we deem it to be meaningless.
        if (inp[indices[i]] >= 0.1 * sparse[indices[0]]) {
            sparse[indices[i]] = inp[indices[i]];
        }
    }
    return sparse;
}

// We only want one instance of this, otherwise we have to keep reloading the
//  tensorflow model etc.
const featureExtractor = new FeatureExtractor();
export default featureExtractor;