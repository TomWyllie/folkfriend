import FeatureDecoder from "@/services/folkfriend/ff-feature-decoder";
import ABCConverter from "@/services/folkfriend/ff-abc";
import featureExtractor from "@/services/folkfriend/ff-feature-extractor.worker";
import contourBeamSearch from "@/services/folkfriend/ff-beam-search";

class Transcriber {
    constructor() {
        this.featureDecoder = new FeatureDecoder();
        this.featureExtractor = featureExtractor;
        this.abcConverter = new ABCConverter();
        this.fedFramesNum = 0;
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

    feedFreqData(freqData) {
        this.fedFramesNum++;
        this.featureExtractor.feedFreqData(freqData, this.fedFramesNum).then();
    }

    async decode() {
        await this.featureExtractor.finished;
        const denoisedFramesSparse = await this.featureExtractor.getDenoisedFramesSparse();
        const featureContour = contourBeamSearch(denoisedFramesSparse);
        this.decoded = await this.featureDecoder.decode(featureContour);
        if(!this.decoded) { return this.decoded; }
        this.decoded.abc = await this.abcConverter.decodedToAbc(this.decoded.decoded);
        return this.decoded;
    }

    async flush() {
        this.fedFramesNum = 0;
        this.featureExtractor.flush();
    }

    async close() {
        // This doesn't shut down this object, it just closes off the featureExtractor
        //  to any new input for this transcription.
        await this.featureExtractor.close();
    }
}

// Export this as singleton worker.
const transcriber = new Transcriber();
export default transcriber;

