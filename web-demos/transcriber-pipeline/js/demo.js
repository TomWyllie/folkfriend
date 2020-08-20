let pipeline;   // For global debugging only

function demo() {
    const recorder = document.getElementById('recorder');

    const audioURLPipeline = getAudioURLPipeline();
    pipeline = audioURLPipeline;

    recorder.addEventListener('change', function(e) {
        const file = e.target.files[0];
        const url = URL.createObjectURL(file);

        console.time("pipeline");
        audioURLPipeline.flush();
        audioURLPipeline.input([url]);
        audioURLPipeline.finish();

        const autocorrelationNode = audioURLPipeline.nodes[1];
        autocorrelationNode.finisher.then(() => {
            const canvas = document.getElementById("ac-canvas");
            let img = tf.concat(autocorrelationNode.outputQueue);
            img = tf.div(img, tf.max(img));
            tf.browser.toPixels(tf.transpose(img), canvas);
        })

        const cnnNode = audioURLPipeline.nodes[2];
        cnnNode.finisher.then(() => {
            const canvas = document.getElementById("cnn-canvas");
            console.debug(cnnNode.outputQueue);
            let img = tf.concat(cnnNode.outputQueue);
            img = tf.div(img, tf.max(img));
            tf.browser.toPixels(tf.transpose(img), canvas);
        })

        const rnnNode = audioURLPipeline.nodes[3];
        rnnNode.finisher.then(() => {
            const canvas = document.getElementById("rnn-canvas");
            console.debug(rnnNode.outputQueue);
            let img = rnnNode.outputQueue[0];
            img = tf.div(img, tf.max(img));
            tf.browser.toPixels(tf.transpose(img), canvas);
        })

        audioURLPipeline.finisher.then(() => {
            console.timeEnd("pipeline");
        });
    });
}

window.onload = demo;
