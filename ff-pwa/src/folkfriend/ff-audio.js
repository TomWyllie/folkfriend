/*
*   This is the only proper FolkFriend code we run on the main thread.
*       This is the seam between the frontend app and backend. All we
*       are concerned with is getting the raw audio data out of the
*       WebAudio API and getting into the worker for further processing,
*       feature extraction and decoding. All that the main thread needs
*       to get back from all these raw audio data is the transcribed midis
*       values. Remember that because we use do of the two FFTs using
*       the web audio API the 'raw audio data' is actually the output
*       of AnalyserNode.getFloatFrequencyData() and not the raw samples.
*
*   Note that for offline mode it might seem a bad idea to be decoding
*       potentially compressed audio (eg MP3) and performing the first FFT,
*       all on the main thread, but actually if we're using an
*       OfflineAudioContext it happens in another thread anyway.
*
*   See
*       https://stackoverflow.com/questions/28134330/can-i-render-to-an-offline-context-in-a-web-worker
* */

import FFConfig from "@/folkfriend/ff-config";
import transcriber from "@/folkfriend/ff-transcriber";

const AUDIO_CONSTRAINTS = {
    audio: {
        echoCancellation: false,
        sampleRate: FFConfig.SAMPLE_RATE
    }
};

class AudioService {
    constructor() {
        this.micActive = false;

        this.audioCtx = null;
        // this.processorNode = null;
        this.micAnalyser = null;

        // this.debug = [];

        this.micSamplerInterval = 1000 * FFConfig.SPEC_WINDOW_SIZE / FFConfig.SAMPLE_RATE;
    }


    async urlToFreqData(url) {
        // Get duration of audio file
        const audio = new Audio();
        audio.src = url;
        await new Promise(resolve => {
            audio.onloadedmetadata = resolve;
        });
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

        /* IMPORTANT NOTE */
        // The audioContext.decodeAudioData function automatically resamples the file to
        //  be the sample rate specified in the audioContext. There's a thread about people
        //  having issues with this (not unreasonably) linked below but in our case it's
        //  super handy. We don't have to worry about differing sample rates in input files,
        //  as this auto-resampling means the script processor always sees FFConfig.SAMPLE_RATE
        //  (ie 48k) data.
        //  https://github.com/WebAudio/web-audio-api/issues/30

        // Connect things up
        source.connect(analyser);
        processor.connect(audioContext.destination);
        const frequencyData = new Float32Array(analyser.frequencyBinCount);
        const freqDataQueue = [];

        // noinspection JSDeprecatedSymbols
        processor.onaudioprocess = () => {
            analyser.getFloatFrequencyData(frequencyData);
            freqDataQueue.push(frequencyData.slice(0));
        };

        source.start(0);

        await audioContext.startRendering();

        return freqDataQueue;
    }

    async startRecording() {
        if (this.micActive) {
            return;
        }

        this.micActive = true;

        await transcriber.flush();

        // This is the case on ios/chrome, when clicking links from within ios/slack (sometimes), etc.
        if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Missing support for navigator.mediaDevices.getUserMedia'); // temp: helps when testing for strange issues on ios/safari
            return;
        }

        this.micCtx = new AudioContext({sampleRate: FFConfig.SAMPLE_RATE});
        this.micAnalyser = new AnalyserNode(this.micCtx, {
            fftSize: FFConfig.SPEC_WINDOW_SIZE,
            smoothingTimeConstant: 0
        });

        try {
            this.micStream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
        } catch (e) {
            console.error(e);
            this.micActive = false;
            return;
        }

        console.debug(this.micCtx.sampleRate);

        this.micSource = this.micCtx.createMediaStreamSource(this.micStream);

        // Connect things up
        this.micSource.connect(this.micAnalyser);

        // this.frequencyData = new Float32Array(this.micAnalyser.frequencyBinCount);
        this.frequencyData = new Float32Array(FFConfig.SPEC_WINDOW_SIZE);
        // noinspection JSDeprecatedSymbols

        this.micSampler = setInterval(() => {
            // Race condition can occur where this is asynchronously called
            //  mid-way through us tearing down the pipeline.
            if (!this.micAnalyser) {
                return;
            }
            this.micAnalyser.getFloatTimeDomainData(this.frequencyData);
            // this.debug.push(frequencyData.slice());
            transcriber.feedFreqData(this.frequencyData.slice(0, 512));
        }, this.micSamplerInterval)
    }

    async stopRecording() {
        if (!this.micActive) {
            return;
        }

        clearInterval(this.micSampler)

        await transcriber.close();

        if (this.micAnalyser) {
            this.micAnalyser.disconnect();
            this.micAnalyser = null;
        }

        this.micStream.getTracks().forEach((track) => track.stop());
        this.micStream = null;

        await this.micCtx.close();
        this.micCtx = null;

        this.micActive = false;
    }
}

const audioService = new AudioService();
export default audioService;