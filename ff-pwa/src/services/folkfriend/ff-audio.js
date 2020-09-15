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

import FFConfig from "@/services/folkfriend/ff-config";

export default class AudioService {

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

        // Connect things up
        source.connect(analyser);
        processor.connect(audioContext.destination);
        const frequencyData = new Float32Array(analyser.frequencyBinCount);
        const freqDataQueue = [];

        // noinspection JSDeprecatedSymbols
        processor.onaudioprocess = () => {
            analyser.getFloatFrequencyData(frequencyData);
            // console.debug(frequencyData);
            freqDataQueue.push(frequencyData.slice(0));
        };

        source.start(0);

        await audioContext.startRendering();

        return freqDataQueue;
    }
}