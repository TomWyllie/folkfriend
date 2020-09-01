// const ffFeatureDecoder = require("./ff-feature-decoder");
// const ffFeatureExtractor = require("./ff-feature-extractor");
// const ffABC = require("./ff-abc");

class Transcriber {
    constructor(rootURL="") {
        this.featureDecoder = new FeatureDecoder();
        this.featureExtractor = new FeatureExtractor(rootURL);
        this.abcConverter = new ABCConverter();
        this.initialise = this.featureExtractor.initialise();
    }

    async transcribeURL(url) {
        await this.initialise;

        this.featureExtractor.flush();
        await this.featureExtractor.urlToFreqData(url);
        this.featureExtractor.closed = true;

        await this.featureExtractor.bulkProceed();
        return this.decode();
    }

    async decode() {
        await this.featureExtractor.finished;
        const featureContour = contourBeamSearch(this.featureExtractor.denoisedFramesSparse);
        this.decoded = this.featureDecoder.decode(featureContour);
        this.decoded.abc = this.abcConverter.decodedToAbc(this.decoded.decoded);

        return this.decoded;
    }
}

class MicrophoneTranscriber extends Transcriber {
    // TODO
    // this.freqDataQueue.push(frequencyData.slice(0));
}

// noinspection JSUnresolvedVariable
if (typeof module !== 'undefined') {

    // noinspection JSUnresolvedVariable
    module.exports = {
        Transcriber: Transcriber,
    }
}