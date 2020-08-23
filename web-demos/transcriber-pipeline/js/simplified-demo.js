let transcriber;

async function demo() {

    transcriber = new Transcriber();
    await transcriber.initialise();

    const recorder = document.getElementById('recorder');
    recorder.addEventListener('change', (e) => {
        onChange(e).catch(console.error);
    });
}

async function wasmDemo(freqDataQueue) {
    const audioDSP = new AudioDSP();
    console.log("waiting...");
    await audioDSP.ready;
    console.log("ready");

    console.time("processFreqData");

    let acFrames = [];
    for(let i = 0; i < freqDataQueue.length; i++) {
        acFrames.push(tf.tensor(audioDSP.processFreqData(freqDataQueue[i])));
    }

    console.timeEnd("processFreqData");

    const canvas = document.getElementById("ac-canvas");
    let img = tf.stack(acFrames);
    // img = tf.expandDims(img, 2);
    img = tf.div(img, tf.max(img));
    console.debug(img.shape);
    tf.browser.toPixels(tf.transpose(img), canvas);
}

async function onChange(e) {
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);

    await transcriber.urlToFreqData(url);

    await wasmDemo(transcriber.freqDataQueue);

    return;


    transcriber.closed = true;
    console.time("bulk-proceed");
    await transcriber.bulkProceed();
    await transcriber.finished;
    console.timeEnd("bulk-proceed");

    console.debug(transcriber);
    console.debug(transcriber.midis);
}

window.onload = () => {
    demo().catch(console.error);
};
