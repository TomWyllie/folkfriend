class Transcriber {
    constructor() {
        this.featureDecoder = new FeatureDecoder();
        this.featureExtractor = new FeatureExtractor();
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

        const features = {
            midis: this.featureExtractor.midis,
            energies: this.featureExtractor.midiEnergies
        }

        let decoded = this.featureDecoder.decode(features);
        decoded.abc = this.abcConverter.decodedToAbc(decoded.decoded);

        return decoded;
    }
}

class MicrophoneTranscriber extends Transcriber {
    // TODO
    // this.freqDataQueue.push(frequencyData.slice(0));
}