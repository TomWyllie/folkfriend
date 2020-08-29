let transcriber;

async function transcriberDemo() {
    transcriber = new Transcriber();

    const recorder = document.getElementById("recorder");
    recorder.addEventListener("change", (e) => {
        onChange(e).catch(console.error);
    });

    const button = document.getElementById("demo");
    button.addEventListener("click", _ => {
        clickDemo().catch(console.error);
    });
}

async function clickDemo() {
    return urlDemo("/external/audio/fiddle.wav");
}


async function onChange(e) {
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    return urlDemo(url);
}


async function urlDemo(url) {
    console.time("transcribe-url");
    const t0 = performance.now();
    const result = await transcriber.transcribeURL(url);
    const perf = performance.now() - t0;
    console.timeEnd("transcribe-url");
    outputResult(result, perf, transcriber.featureExtractor.networkPerf);

    if(FFDebug) {
        let canv = document.getElementById("cnn-canvas");
        let pixels = tf.concat(transcriber.featureExtractor.debugDenoised);
        pixels = tf.div(pixels, tf.max(pixels));
        tf.browser.toPixels(tf.transpose(pixels), canv);
    }
}

function outputResult(result, perf, networkPerf) {
    let p1 = document.createElement("p");
    let p2 = document.createElement("p");
    let p3 = document.createElement("p");
    let p4 = document.createElement("p");
    let p5 = document.createElement("p");

    p1.textContent = result.abc;
    p2.textContent = `Tempo was ${result.tempo} BPM`;
    p3.textContent = `FolkFriend ${Math.round(1000*perf)/1000} milliseconds`;
    p4.textContent = `Network ${Math.round(1000*networkPerf)/1000} milliseconds`;
    p5.textContent = `${result.score}`;

    document.body.appendChild(p1);
    document.body.appendChild(p2);
    document.body.appendChild(p3);
    document.body.appendChild(p4);
    document.body.appendChild(p5);
}

window.onload = () => {
    transcriberDemo().catch(console.error);
};
