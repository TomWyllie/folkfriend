// noinspection JSFileReferences
import FFConfig from "./ff-config.js";
// noinspection JSFileReferences
import featureExtractor from "./ff-cnn.js";
// noinspection JSFileReferences
import dsp from "./ff-dsp.js";

function main() {
    dsp.initialise().then();
    featureExtractor.initialise().then();

    document.getElementById("begin").onclick = () => {
        demo().then();
    };
}

async function demo() {
    const timeDomainDataQueue = await urlToTimeDomainData('fiddle.wav');
    await dsp.ready;

    await featureExtractor.ready;
    await featureExtractor.flush();

    let processedFrames = [];

    console.time('ff-dsp');
    for(let freqData of timeDomainDataQueue) {
        let frame = dsp.processTimeDomainData(freqData.slice());
        processedFrames.push(frame);
    }
    console.timeEnd('ff-dsp');
    renderDebugImage(processedFrames);

    console.time('ff-cnn');
    for(let [i, frame] of processedFrames.entries()) {
        await featureExtractor.feed(frame, i);
    }
    await featureExtractor.advance();
    const features = await featureExtractor.gather();

    console.timeEnd('ff-cnn');
    renderDebugImage(features);

}

// Taken from ff-audio.js
async function urlToTimeDomainData(url) {
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
    const timeDomainData = new Float32Array(FFConfig.SPEC_WINDOW_SIZE);
    const timeDomainDataQueue = [];

    // noinspection JSDeprecatedSymbols
    processor.onaudioprocess = () => {
        analyser.getFloatTimeDomainData(timeDomainData);
        timeDomainDataQueue.push(timeDomainData.slice(0));
    };

    source.start(0);

    await audioContext.startRendering();

    return timeDomainDataQueue;
}

function renderDebugImage(typedArrays) {
    const w = typedArrays.length;
    const h = typedArrays[0].length;
    const scale = 1;

    const canvas = document.createElement('canvas');
    canvas.setAttribute("style", "zoom: 2; image-rendering: pixelated; display: block;");
    canvas.width = scale * w;
    canvas.height = scale * h;

    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    const imageData = ctx.createImageData(w, h);

    const max = Math.max(...typedArrays.map(x => Math.max(...x)).filter(x => isFinite(x)));
    const min = Math.min(...typedArrays.map(x => Math.min(...x)).filter(x => isFinite(x)));
    const range = max - min;

    // Iterate through every pixel
    for (let x = 0; x < w; x++) {
        for (let y = 0; y < h; y++) {
            const i = 4 * (y * w + x);
            const v = Math.round(255 * (typedArrays[x][y] - min) / range);
            imageData.data[i] = v;          // R value
            imageData.data[i + 1] = v;      // G value
            imageData.data[i + 2] = v;      // B value
            imageData.data[i + 3] = 255;    // A value
        }
    }

    // Draw image data to the canvas
    ctx.putImageData(imageData, 0, 0);

    document.body.appendChild(canvas);
}

window.onload = main;