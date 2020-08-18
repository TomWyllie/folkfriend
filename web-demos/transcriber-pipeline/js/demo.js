function demo() {
    const recorder = document.getElementById('recorder');

    const audioURLPipeline = getAudioURLPipeline();

    recorder.addEventListener('change', function(e) {
        const file = e.target.files[0];
        const url = URL.createObjectURL(file);
        audioURLPipeline.input([url]);
        audioURLPipeline.finish();
        audioURLPipeline.finisher.then(() => {
            console.log(audioURLPipeline);

            const canvas = document.getElementById("output-canvas");
            let img = tf.concat(audioURLPipeline.outputQueue);
            img = tf.div(img, tf.max(img));
            tf.browser.toPixels(tf.transpose(img), canvas);
        })
    });
}

window.onload = demo;
