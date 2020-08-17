function demo() {
    const recorder = document.getElementById('recorder');

    const audioURLPipeline = getAudioURLPipeline();

    recorder.addEventListener('change', function(e) {
        const file = e.target.files[0];
        const url = URL.createObjectURL(file);
        audioURLPipeline.input([url]);
        audioURLPipeline.finisher.then(() => {
            console.log(audioURLPipeline);
        })
    });
}

window.onload = demo;
