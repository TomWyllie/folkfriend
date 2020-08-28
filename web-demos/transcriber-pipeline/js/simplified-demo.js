let transcriber;

async function demo() {

    transcriber = new Transcriber();
    await transcriber.initialise();

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
    return urlDemo("audio/fiddle.wav");
}


async function onChange(e) {
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);
    return urlDemo(url);
}


async function urlDemo(url) {
    transcriber.flush();
    await transcriber.urlToFreqData(url);

    transcriber.closed = true;
    console.time("bulk-proceed");
    await transcriber.bulkProceed();
    await transcriber.finished;
    console.timeEnd("bulk-proceed");

    console.debug(transcriber.decoded);
    outputResult();

    console.debug(transcriber);
    console.debug(transcriber.midis);

    let canv = document.getElementById("cnn-canvas");
    let pixels = tf.concat(transcriber.debugDenoised);
    pixels = tf.div(pixels, tf.max(pixels));
    tf.browser.toPixels(tf.transpose(pixels), canv);
}

function outputResult() {
    let p1 = document.createElement("p");
    let p2 = document.createElement("p");
    let p3 = document.createElement("p");
    let abc = decoded_to_abc(transcriber.output.decoded)
    console.debug(abc);

    p1.textContent = decoded_to_abc(transcriber.output.decoded);
    p2.textContent = `${transcriber.output.tempo} BPM`;
    p3.textContent =  `${transcriber.output.score}`;

    document.body.appendChild(p1);
    document.body.appendChild(p2);
    document.body.appendChild(p3);
}

window.onload = () => {
    demo().catch(console.error);
};
