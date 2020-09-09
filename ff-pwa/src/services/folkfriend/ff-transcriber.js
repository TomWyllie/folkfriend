import FeatureDecoder from "@/services/folkfriend/ff-feature-decoder";
import ABCConverter from "@/services/folkfriend/ff-abc";
import featureExtractor from "@/services/folkfriend/ff-feature-extractor.worker";
import contourBeamSearch from "@/services/folkfriend/ff-beam-search";

class Transcriber {
    constructor() {
        this.featureDecoder = new FeatureDecoder();
        this.featureExtractor = featureExtractor;
        this.abcConverter = new ABCConverter();
    }

    async transcribeFreqData(freqDataQueue) {
        // These are already computed from the main thread, because
        //  AudioContext / OfflineAudioContext requires main thread.
        this.featureExtractor.flush();
        this.featureExtractor.freqDataQueue = freqDataQueue;
        this.featureExtractor.closed = true;
        await this.featureExtractor.bulkProceed();
        return this.decode();
    }

    async decode() {
        await this.featureExtractor.finished;
        const denoisedFramesSparse = await this.featureExtractor.getDenoisedFramesSparse();
        const featureContour = contourBeamSearch(denoisedFramesSparse);
        this.decoded = await this.featureDecoder.decode(featureContour);
        this.decoded.abc = await this.abcConverter.decodedToAbc(this.decoded.decoded);
        return this.decoded;
    }

    async flush() {
        this.featureExtractor.flush();
    }
}

// Export this as singleton worker.
const transcriber = new Transcriber();
export default transcriber;

// class MicrophoneTranscriber extends Transcriber {
// TODO
// this.freqDataQueue.push(frequencyData.slice(0));
// }
