let transcriber;

async function demo() {

    transcriber = new Transcriber();
    await transcriber.initialise();

    // const recorder = document.getElementById('recorder');
    // recorder.addEventListener('change', (e) => {
    //     onChange(e).catch(console.error);
    // });

    const button = document.getElementById('demo');
    button.addEventListener('click', _ => {
        clickDemo().catch(console.error);
    });
}


async function clickDemo(e) {
    await transcriber.urlToFreqData("audio/maddie.wav");

    // await wasmDemo(transcriber.freqDataQueue);
    // return;

    transcriber.closed = true;
    console.time("bulk-proceed");
    await transcriber.bulkProceed();
    await transcriber.finished;
    console.timeEnd("bulk-proceed");

    console.debug(transcriber);
    console.debug(transcriber.midis);
}

async function onChange(e) {
    const file = e.target.files[0];
    const url = URL.createObjectURL(file);

    await transcriber.urlToFreqData(url);

    // await wasmDemo(transcriber.freqDataQueue);
    // return;

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
