/* eslint-disable */
import abcConverter from "@/folkfriend/ff-abc";
import dsp from "@/folkfriend/ff-dsp"
import featureExtractor from "@/folkfriend/ff-cnn";
import contourExtractor from "@/folkfriend/ff-contour";
import contourDecoder from "@/folkfriend/ff-decoder";

class Transcriber {
    constructor() {
        this.fedFramesNum = 0;
        this.ready = new Promise((resolve) => {
            this.setReady = resolve;
        });
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

        let processedFrames = [];

        for(let timeDomainData of timeDomainDataQueue) {
            let spectrogramFrame = dsp.processTimeDomainData(timeDomainData.slice());
            processedFrames.push(spectrogramFrame);
        }

        for(let frame of processedFrames) {
            await this.feed(frame);
        }

        await featureExtractor.advance();
        const features = await featureExtractor.gather();
        const contour = await contourExtractor.contourFromFeatures(features);
        const decodedAudio = await contourDecoder.decode(contour);
        decodedAudio.abc = abcConverter.decodedToAbc(decodedAudio.midis);
        return decodedAudio;
    }

    async feed(frame) {
        await featureExtractor.feed(frame, this.fedFramesNum);
        this.fedFramesNum++;
    }

    async flush() {
        this.fedFramesNum = 0;
        await featureExtractor.flush();
    }
}

// Export this as singleton worker.
const transcriber = new Transcriber();
export default transcriber;

