import ffBackend from "@/services/backend.js";
import ffConfig from "@/ffConfig.js";
import store from "./store";

const AUDIO_CONSTRAINTS = {
    audio: {
        echoCancellation: false
    }
};

class MicService {
    constructor() {
        this.micProcessor = null;
        this.audioCtx = null;
        this.opening = Promise.resolve();
        this.finishOpening = null;
        this.bufferSize = 1024;

        this.recordingTimer = null;
    }

    async startRecording() {
        if (store.isRecording()) {
            return;
        }
        store.setSearchState(store.searchStates.RECORDING);

        // It's possible for a call to stopRecording to come in whilst we are
        //  still running startRecording (if the button is pushed very quickly).
        //  Track how we're doing setting up the audio pipeline so we can
        //  block stopRecording until this is finished.
        this.opening = new Promise((resolve) => {
            this.finishOpening = resolve;
        });


        // This is the case on ios/chrome, when clicking links from within ios/slack (sometimes), etc.
        if (!navigator || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('Missing support for navigator.mediaDevices.getUserMedia');
            throw 'Missing support for navigator.mediaDevices.getUserMedia';
        }

        let sampleRate;
        try {
            this.micStream = await navigator.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
            sampleRate = this.micStream.getTracks()[0].getSettings().sampleRate;

            // TODO integrate this with the sample rate checking included in rust
            // const nyq = sampleRate / 2;
            // this.usingSampleRate = sampleRate;

            // // Recall the highest interpolated value in the spectral frame from
            // //  the dsp functions is greater than the midi value (up to half a
            // //  note higher). Give ourselves some space to breathe.
            // if (utils.midiToHertz(FFConfig.MIDI_HIGH + 1) > nyq) {
            //     // noinspection ExceptionCaughtLocallyJS
            //     throw `Sample rate too low: ${sampleRate}`;
            // }

            ffBackend.setSampleRate(sampleRate).then(() => {
                console.debug(`Using context sample rate ${sampleRate}Hz`);
            });
        } catch (e) {
            this.finishOpening();

            console.error(e);

            await this.stopRecording();
            store.setSearchState(store.searchStates.READY);

            // Propagate
            throw e;
        }

        // IMPORTANT NODE: we can simply set
        //  { sampleRate: FFConfig.SAMPLE_RATE }
        //  as a config for this constructor and Chrome magically resamples
        //  everything into our desired sample rate. Unfortunately I don't
        //  trust that this works in Safari etc so we allow arbitrary
        //  sampleRates (within reason), which we detect after getUserMedia.
        //  The WebAssembly DSP functions can handle arbitrary sample rates.
        this.audioCtx = new AudioContext({ sampleRate: sampleRate });

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

        // Yes yes, ScriptProcessorNode is deprecated. But there isn't enough
        //  widespread support for anything else (e.g. AudioWorklet) to replace
        //  it yet. But the cognoscente (rtoy) reckon it's not going anywhere 
        //  anytime soon; https://github.com/WebAudio/web-audio-api/issues/2391.
        this.micProcessor = this.audioCtx.createScriptProcessor(this.bufferSize, 1, 1);
        this.micProcessor.onaudioprocess = function (audioProcessingEvent) {
            let channelData = audioProcessingEvent.inputBuffer.getChannelData(0);
            // console.debug("audioProcessingEvent");
            ffBackend.feedSinglePCMWindow(channelData);
        }

        // Connect things up
        this.micSource = this.audioCtx.createMediaStreamSource(this.micStream);
        this.micSource.connect(this.micProcessor);
        console.debug(this.audioCtx);
        this.micProcessor.connect(this.audioCtx.destination);

        this.finishOpening();
    }

    async stopRecording() {
        // There is never a use case where we don't want this to be in working state
        //  Even if the mic has failed to open we might still have to wait a second
        //  before the audio context closes.
        store.setSearchState(store.searchStates.WORKING);

        // Make sure we don't try to close whilst in the process
        //  of opening.
        await this.opening;

        if (this.micProcessor) {
            this.micProcessor.disconnect();
            this.micProcessor = null;
        }

        if (this.micStream) {
            this.micStream.getTracks().forEach((track) => track.stop());
            this.micStream = null;
        }

        if (this.audioCtx) {
            await this.audioCtx.close();
            this.audioCtx = null;
        }
    }
}

const micService = new MicService();
export default micService;