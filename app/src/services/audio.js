import ffBackend from '@/services/backend.js';

class AudioService {
    constructor() {
        this.micActive = false;
        this.audioCtx = null;
        this.micAnalyser = null;

        // IMPORTANT - issues with standardized-audio-context not respecting
        //  this value going above 2048 and missing out 50% of frames.
        //  (needs further examination)
        this.timeDomainBufferSize = 1024;
        this.opening = Promise.resolve();
        this.finishOpening = null;
        this.sampleRate = 48000;
    }

    async urlToTimeDomainData(url) {
        // Get duration of audio file
        const audio = new Audio();
        audio.src = url;
        await new Promise(resolve => {
            audio.onloadedmetadata = resolve;
        });
        audio.removeAttribute('src'); // Don't yet load in the rest of the file

        await ffBackend.setSampleRate(this.sampleRate);

        const offlineNumSamples = audio.duration * this.sampleRate;

        /*   Note that for offline mode it might seem a bad idea to be decoding
        potentially compressed audio (eg MP3) on the main thread, but
        actually if we're using an OfflineAudioContext it happens in
        another thread anyway.
        See https://stackoverflow.com/questions/28134330/can-i-render-to-an-offline-context-in-a-web-worker
        */

        // Get context (using polyfill)
        const audioContext = new OfflineAudioContext(1, offlineNumSamples, this.sampleRate);

        // Load data into source
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);

        /* IMPORTANT NOTE */
        // The audioContext.decodeAudioData function automatically resamples the file to
        //  be the sample rate specified in the audioContext. There's a thread about people
        //  having issues with this (not unreasonably) linked below but in our case it's
        //  super handy. We don't have to worry about differing sample rates in input files,
        //  as this auto-resampling means the script processor always sees FFConfig.SAMPLE_RATE
        //  (ie 48k) data.
        //  https://github.com/WebAudio/web-audio-api/issues/30
        return decodedBuffer.getChannelData(0);
    }
}

const audioService = new AudioService();
export default audioService;