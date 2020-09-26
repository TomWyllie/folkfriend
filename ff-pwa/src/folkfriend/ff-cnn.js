// Basic import tensorflow, including WASM backend
const tf = require('@tensorflow/tfjs');
// import '@tensorflow/tfjs-layers';
import '@tensorflow/tfjs-backend-wasm';
import {setWasmPaths} from '@tensorflow/tfjs-backend-wasm';
setWasmPaths('/tf/');
// If running in cpp-wasm/demo comment out the above lines as imports are done by index.html

import FFConfig from './ff-config.js';

class FeatureExtractor {
    /* This will run in a worker so everything will be async. */
    constructor() {
        this.model = null;
        this._flushSync();

        this.ready = new Promise((resolve) => {
            this.setReady = resolve;
        });
    }

    async initialise() {
        // Activate safe mode so we're on our best behaviour in terms of
        //  memory management. We are using WebAssembly here, on Tom's
        //  machine (Phoenix) with i5-4670k @ 3.4GHz / 8GB / GTX 1060 3GB
        //  WASM comes in at 10x faster with around 250 - 400ms versus WebGL's
        //  2500 - 4000 ms.
        await tf.setBackend('wasm', true);
        await tf.ready();
        this.model = await tf.loadLayersModel('tf/model/model.json');
        this.setReady();
    }

    async flush() {
        this._flushSync();
    }

    _flushSync() {
        // Initial padding
        this.spectralFrames = new Array(FFConfig.CONTEXT_FRAMES / 2);
        this.spectralFrames.fill(new Float32Array(FFConfig.SPEC_NUM_BINS));
        this.numSpectralFrames = 0;

        this.features = [];
        this.isAdvancing = false;
    }

    async setUnfinishedAdvancing() {
        // Always resolved, so if anywhere awaits this it'll skip over.
        this.finishedAdvancing = Promise.resolve();
    }

    async feed(spectralFrame, expectedFrame) {
        if (expectedFrame !== this.numSpectralFrames) {
            throw `Possible desynchronisation: ${expectedFrame}, ${this.numSpectralFrames}`;
        }
        this.spectralFrames.push(spectralFrame);
        this.numSpectralFrames++;
    }

    async advance() {
        await this.ready;

        // Lock us to be in only one of the following while loops at once.
        //  Expose a promise this.finishedAdvancing which can be awaited
        //  and guarantees
        if (this.isAdvancing) {
            return;
        }

        this.isAdvancing = true;

        // Anywhere that tries to await this.finishedAdvancing *whilst this
        //  loop is ongoing* will be blocked until all advanced.
        let setFinishedAdvancing = () => {
        };
        this.finishedAdvancing = new Promise((resolve) => {
            setFinishedAdvancing = resolve;
        });

        let sentinel = 0;
        while (this.canAdvance) {
            sentinel++;
            if (sentinel > 1000) {
                throw 'too many iterations';
            }

            const featureFrame = tf.tidy(() => {

                // We are going to take this frame and denoise it
                const originalFrame = this.spectralFrames[Math.ceil(FFConfig.CONTEXT_FRAMES / 2)];
                const originalPower = originalFrame.reduce((a, b) => a + b);

                // Fill up buffer with queued frames as CNN needs context of
                //  frames either side for the denoising model.
                const inputTensorBuffer = new Float32Array(FFConfig.CONTEXT_FRAMES * FFConfig.SPEC_NUM_BINS);
                for (let i = 0; i < FFConfig.CONTEXT_FRAMES; i++) {
                    inputTensorBuffer.set(this.spectralFrames[i], i * FFConfig.SPEC_NUM_BINS);
                }

                // Batch, Width, Height, Channels
                let tensorInput = tf.tensor(inputTensorBuffer, [1, FFConfig.CONTEXT_FRAMES, FFConfig.SPEC_NUM_BINS, 1]);

                // This division means we take no account of magnitude, only
                //  how much this looks like a note. We'll multiply this by
                //  the sum of the feature bins of this frame to account for
                //  varying volume. We could do this elementwise and multiply
                //  the predicted mask by the original frame but this is (a)
                //  slower and (b) the generated mask introduces a degree of
                //  smoothing which is actually helpful for the decoder.
                //  TODO validate this logic and make sure it is genuinely
                //   better
                tensorInput = tf.divNoNan(tensorInput, tf.max(tensorInput));

                const mask = this.model.predictOnBatch(tensorInput);

                return tf.mul(originalPower, mask);
            });

            this.features.push(await featureFrame.data());
            this.spectralFrames.shift();
        }

        this.isAdvancing = false;
        setFinishedAdvancing();
    }

    get canAdvance() {
        // Require this many frames to be buffered to have enough context for
        //  the CNN. To avoid losing CONTEXT_FRAMES / 2 valuable frames at each
        //  end, which is a loss of ~100ms overall, we pad spectralFrames at
        //  the start and the end.
        return this.spectralFrames.length >= FFConfig.CONTEXT_FRAMES;
    }

    async gather() {
        await this.finishedAdvancing;

        // End padding
        for(let i = 0; i < FFConfig.CONTEXT_FRAMES / 2 - 1; i++) {
            this.spectralFrames.push(new Float32Array(FFConfig.SPEC_NUM_BINS));
        }

        await this.advance();
        return this.features;
    }
}

let featureExtractor = new FeatureExtractor();
export default featureExtractor;
