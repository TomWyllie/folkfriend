import abcConverter from "@/folkfriend/ff-abc";
import FFConfig from "@/folkfriend/ff-config";
import contourExtractor from "@/folkfriend/ff-contour";
import featureExtractor from "@/folkfriend/ff-cnn";
import contourDecoder from "@/folkfriend/ff-decoder";
import dsp from "@/folkfriend/ff-dsp";

class Transcriber {
    constructor() {
        this.fedFramesNum = 0;
        this.ready = new Promise((resolve) => {
            this.setReady = resolve;
        });

        // Can intercept input samples for debugging
        // Can intercept WASM DSP output for debugging
        // this.debugQueue = [];
    }

    async initialise() {
        // These two both take a bit of time - we need to load in Tensorflow
        //  and let its backend ready up, and load the .WASM file too.
        //  That means both of these should be initialised *as a priority*
        //  when opening the app, as loading in the query engine or database
        //  can only be useful after a query is desired. Audio transcription
        //  however can be requested instantly by the user, particularly if
        //  in a genuine session where a tune may finish soon.
        await featureExtractor.initialise();
        await dsp.initialise();
        this.setReady();
    }

    async transcribeTimeDomainData(timeDomainDataQueue) {
        await this.ready;
        await this.flush();

        for (let timeDomainData of timeDomainDataQueue) {
            await this.feed(timeDomainData);
        }

        await featureExtractor.advance();
        return this.gatherAndDecode();
    }

    async gatherAndDecode() {
        // return this.debugQueue;
        const features = await featureExtractor.gather();
        if (features.length === 0) {
            return false;
        }
        const contour = await contourExtractor.contourFromFeatures(features);
        const decodedAudio = await contourDecoder.decode(contour);
        if (decodedAudio) {
            decodedAudio.abc = abcConverter.decodedToAbc(decodedAudio.midis);
        }
        return decodedAudio;
    }

    async feed(timeDomainData) {
        const frames = Math.floor(timeDomainData.length / FFConfig.SPEC_WINDOW_SIZE);
        if (frames === 0) {
            throw 'Frame too short';
        }
        for (let i = 0; i < frames; i++) {
            const timeDomainWindow = timeDomainData.slice(
                FFConfig.SPEC_WINDOW_SIZE * i,
                FFConfig.SPEC_WINDOW_SIZE * (i + 1)
            );
            let spectrogramFrame = dsp.processTimeDomainData(timeDomainWindow);

            // this.debugQueue.push(spectrogramFrame);
            // this.debugQueue.push(timeDomainWindow.slice());

            await featureExtractor.feed(spectrogramFrame, this.fedFramesNum);
            this.fedFramesNum++;
        }
    }

    async flush() {
        this.fedFramesNum = 0;
        await featureExtractor.flush();
    }

    async setSampleRate(sampleRate) {
        // This wrapper is necessary as we can't directly call dsp (which lives
        //  on a worker thread, because it's imported by this transcriber,
        //  lives on a worker thread) from the main thread. But we can async
        //  call this worker from the main thread, which can in turn call dsp.
        await dsp.setSampleRate(sampleRate);
    }

    async advance() {
        // This wrapper allows us to access featureExtractor functions through
        //  the worker. If we import featureExtractor onto the main thread,
        //  then Webpack re-bundles TensorflowJS into both worker and
        //  non-worker code!!
        await featureExtractor.advance();
    }
}

// Export this as singleton worker.
const transcriber = new Transcriber();
export default transcriber;

