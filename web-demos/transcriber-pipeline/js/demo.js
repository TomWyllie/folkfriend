let pipeline;   // For global debugging only

async function demo() {
    const recorder = document.getElementById('recorder');

    console.time("get-pipeline");
    pipeline = await getAudioURLPipeline();
    console.timeEnd("get-pipeline");

    console.time("pipeline-ready");
    await pipeline.ready;
    console.timeEnd("pipeline-ready");

    recorder.addEventListener('change', (e) => {
        onChange(e).catch(console.error);
    });
}

async function onChange(e) {
    const audioURLPipeline = pipeline;
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);

    console.time("pipeline");
    audioURLPipeline.input([url]);
    audioURLPipeline.finish();

    // Turn off canvas drawing if we're trying to benchmark how fast
    //  the pipeline is, because the toPixels slows things down
    //  significantly.
    const benchmarking = true;

    const autocorrelationNode = audioURLPipeline.nodes[1];
    await autocorrelationNode.finished;
    if(!benchmarking) {
        const canvas = document.getElementById("ac-canvas");
        let img = tf.concat(autocorrelationNode.outputQueue);
        img = tf.div(img, tf.max(img));
        tf.browser.toPixels(tf.transpose(img), canvas);
    }

    const cnnNode = audioURLPipeline.nodes[3];
    await cnnNode.finished
    if(!benchmarking) {
        const canvas = document.getElementById("cnn-canvas");
        let img = tf.concat(cnnNode.outputQueue);
        img = tf.div(img, tf.max(img));
        tf.browser.toPixels(tf.transpose(img), canvas);
    }

    // const rnnNode = audioURLPipeline.nodes[4];
    // rnnNode.finished.then(() => {
    //     if(benchmarking) {return}
        // For viewing predictions from RNN
        // console.debug(rnnNode.outputQueue);
        // let img = rnnNode.outputQueue[0];
        // img = tf.sub(img, tf.min(img));
        // img = tf.div(img, tf.max(img));
        // tf.browser.toPixels(tf.transpose(img), canvas);
    // })

    const result = await audioURLPipeline.result();
    console.timeEnd("pipeline");
    const resultsDiv = document.createElement("div");
    resultsDiv.innerText = result.join(' ');
    document.body.appendChild(resultsDiv);
}

window.onload = () => {
    demo().catch(console.error);
};
