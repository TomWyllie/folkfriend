/*
*   This is the only proper transcription code we run on the main thread.
*       This is the seam between the frontend app and backend. All we
*       are concerned with is getting the raw audio samples out of the
*       WebAudio API and getting into the worker for further processing,
*       feature extraction and decoding. All that the main thread needs
*       to get back from all these raw audio data is the transcribed midis
*       values.
*
*   Note that for offline mode it might seem a bad idea to be decoding
*       potentially compressed audio (eg MP3) on the main thread, but
*       actually if we're using an OfflineAudioContext it happens in
*       another thread anyway.
*
*   See
*       https://stackoverflow.com/questions/28134330/can-i-render-to-an-offline-context-in-a-web-worker
* */

import FFConfig from "@/folkfriend/ff-config";
import transcriber from "@/folkfriend/ff-transcriber.worker";
import utils from "@/folkfriend/ff-utils";
import {AudioContext, OfflineAudioContext} from 'standardized-audio-context';

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
        this.micAnalyser = null;
        // IMPORTANT - issues with standardized-audio-context not respecting
        //  this value going above 2048 and missing out 50% of frames.
        //  (needs further examination)
        this.timeDomainBufferSize = 2048;
        this.opening = Promise.resolve();
        this.finishOpening = null;
    }

    async urlToTimeDomainData(url) {
        // Get duration of audio file
        const audio = new Audio();
        audio.src = url;
        await new Promise(resolve => {
            audio.onloadedmetadata = resolve;
        });
        const offlineNumSamples = audio.duration * FFConfig.SAMPLE_RATE;
        audio.removeAttribute('src'); // Don't yet load in the rest of the file

        // Get context (using polyfill)
        const audioContext = new OfflineAudioContext(1, offlineNumSamples, FFConfig.SAMPLE_RATE);

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
        return [decodedBuffer.getChannelData(0)];
    }

    async startRecording() {
        if (this.micActive) {
            return;
        }

        this.micActive = true;

        // It's possible for a call to stopRecording to come in whilst we are
        //  still running startRecording (if the button is pushed very quickly).
        //  Track how we're doing setting up the audio pipeline so we can
        //  block stopRecording until this is finished.
        this.opening = new Promise((resolve) => {
            this.finishOpening = resolve;
        });

        await transcriber.flush();

        // This is the case on ios/chrome, when clicking links from within ios/slack (sometimes), etc.
        if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw 'Missing support for navigator.mediaDevices.getUserMedia';
        }

        let sampleRate;
        try {
            this.micStream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
            sampleRate = this.micStream.getTracks()[0].getSettings().sampleRate;
            const nyq = sampleRate / 2;

            // Recall the highest interpolated value in the spectral frame from
            //  the dsp functions is greater than the midi value (up to half a
            //  note higher). Give ourselves some space to breathe.
            if (utils.midiToHertz(FFConfig.MIDI_HIGH + 1) > nyq) {
                // noinspection ExceptionCaughtLocallyJS
                throw `Sample rate too low: ${sampleRate}`;
            }

            console.debug(`Using context sample rate ${sampleRate}Hz`);
            await transcriber.setSampleRate(sampleRate);

        } catch (e) {
            this.micActive = false;
            throw e;
        }

        // IMPORTANT NODE: we can simply set
        //  { sampleRate: FFConfig.SAMPLE_RATE }
        //  as a config for this constructor and Chrome magically resamples
        //  everything into our desired sample rate. Unfortunately I don't
        //  trust that this works in Safari etc so we allow arbitrary
        //  sampleRates (within reason), which we detect after getUserMedia.
        //  The WebAssembly DSP functions can handle arbitrary sample rates.
        this.micCtx = new AudioContext({sampleRate: sampleRate});

        // TODO this needs investigated further and confirmed the value is high
        //  enough for different devices.
        // Ideally we would set fftSize to FFConfig.SPEC_WINDOW_SIZE but on
        //  some devices (confirmed on Tom's old Samsung Galaxy S6) this
        //  introduces glitches where WebAudio can't update itself fast
        //  enough, so each frame is duplicated three or four times without
        //  changing (disastrously bad for audio quality). We choose a longer
        //  size which introduces more latency (which doesn't really matter)
        //  which reduces glitches. The latency doesn't matter because we're
        //  not doing any real-time processing of audio that is *sent back* to
        //  to the user.
        this.micAnalyser = this.micCtx.createAnalyser({
            fftSize: this.timeDomainBufferSize,
            smoothingTimeConstant: 0
        });

        this.micSource = this.micCtx.createMediaStreamSource(this.micStream);

        // Connect things up
        this.micSource.connect(this.micAnalyser);

        let micSamplerInterval = this.getMicSamplerInterval(sampleRate);
        this.timeDomainData = new Float32Array(this.timeDomainBufferSize);
        this.micSampler = setInterval(() => {
            // Race condition can occur where this is asynchronously called
            //  mid-way through us tearing down the pipeline.
            if (!this.micAnalyser) {
                return;
            }
            this.micAnalyser.getFloatTimeDomainData(this.timeDomainData);
            transcriber.feed(this.timeDomainData.slice(0)).then(() => {
                transcriber.advance().then();
            });
        }, micSamplerInterval);

        this.finishOpening();
    }

    async stopRecording() {
        if (!this.micActive) {
            return;
        }

        // Make sure we don't try to close whilst in the process
        //  of opening.
        await this.opening;

        clearInterval(this.micSampler);

        if (this.micAnalyser) {
            this.micAnalyser.disconnect();
            this.micAnalyser = null;
        }

        if (this.micStream) {
            this.micStream.getTracks().forEach((track) => track.stop());
            this.micStream = null;
        }

        if (this.micCtx) {
            await this.micCtx.close();
            this.micCtx = null;
        }

        this.micActive = false;
    }

    getMicSamplerInterval(sampleRate) {
        return 1000 * this.timeDomainBufferSize / sampleRate;
    }
}

const audioService = new AudioService();
export default audioService;