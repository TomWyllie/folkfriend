let transcriber, queryEngine;

function main() {
    transcriber = new Transcriber();
    queryEngine = new QueryEngineGPU();
    queryEngine.initialise().catch(console.error);

    document.getElementById("evaluate-dataset").onclick = _ => {
        datasetDemo().catch();
    };

    document.getElementById("download-textbox").onclick = _ => {
        const textOutput = document.getElementById("results-textbox");
        saveTextAsFile(textOutput.textContent, "results.csv");
    }
}

async function datasetDemo() {

    const settingsToTunes = await getSettingsToTunes();

    const recordings = await loadCSV("/dataset/recordings.csv");
    const recordingsToTunes = {}
    for(let i = 0; i < recordings.data.length; i++) {
        recordingsToTunes[recordings.data[i].path] = recordings.data[i]["thesession-id"];
    }

    const slices = await loadCSV("/dataset/slices.csv");
    const slicesToTunes = {}
    for(let i = 0; i < slices.data.length; i++) {
        slicesToTunes[slices.data[i].path] = recordingsToTunes[
            slicePathToRecordingPath(
                slices.data[i].path
            )
        ];
    }

    const progressInfo = document.getElementById("progress");
    const textOutput = document.getElementById("results-textbox");

    let t0 = performance.now();
    for(let i = 0; i < slices.data.length; i++) {
        if(i === 10) {
            throw "breakpoint";
        }

        let sliceURL = `/dataset/${slices.data[i].path}`;

        console.time("transcribe");
        let transcription = await transcriber.transcribeURL(sliceURL);
        console.timeEnd("transcribe");
        console.time("query");
        let results = await queryEngine.query(transcription.decoded).catch(console.error);
        console.timeEnd("query");
        console.warn(tf.memory());

        // Now go through the results. Remember the ID of each result
        //  is the *setting ID* that has been matched not the *tune ID*.
        //  Record the highest score setting for each tune.
        let tunesRanking = {};
        let tunes = 0;
        for(let i = 0; i < results.length; i++) {
            let tune = settingsToTunes[parseInt(results[i].key)];
            if(!tunesRanking.hasOwnProperty(tune)) {
                tunesRanking[tune] = tunes;
                tunes++;
            }
        }

        // Now let's look at the label for what the tune ID should have been
        let groundTruth = slicesToTunes[slices.data[i].path];

        // 0 means correct label was ranked first (best score).
        //  Worst score is results.length (100) which means that
        //  the tune was ranked outside the top results.length.
        let score = tunesRanking[groundTruth] || results.length;

        let dataLine = `${slices.data[i].path},${score}\n`;
        textOutput.textContent += dataLine;
        console.info(dataLine);

        let perf = (performance.now() - t0) / (1 + i);
        perf = Math.round(1000 * perf) / 1000;
        let minutesRemaining = perf * (slices.data.length - i - 1) / 60000;
        minutesRemaining = Math.round(100 * minutesRemaining) / 100;
        progressInfo.textContent = `Progress: ${i} / ${slices.data.length}, 
        at ${perf}ms per tune, (${minutesRemaining} minutes remaining)`;
    }
}

// async function analyseResults() {
//     console.debug(recordings);
// }

async function getSettingsToTunes() {
    const tunes = await loadCSV("/dataset/tunes.csv");
    let settingsToTunes = {}
    tunes.data.forEach(e => {
       // noinspection JSUnresolvedVariable
        settingsToTunes[e.setting] = e.tune;
    });
    return settingsToTunes;
}

function slicePathToRecordingPath(s) {
    // We enumerate each recording slice and move to slices folder.
    //  undo this.
    //  [ slices/ ]<path to file>[ _\d\d\d.mp3 ]
    return `${s.slice(7, s.length - 8)}.mp3`
}

function loadCSV(CSV) {
    return new Promise(resolve => {
        Papa.parse(CSV, {
            dynamicTyping: true,
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: resolve
        });
    });
}

function saveTextAsFile(textToWrite, fileNameToSaveAs) {
    let textFileAsBlob = new Blob([textToWrite], {type:'text/plain'});
    let downloadLink = document.createElement("a");
    downloadLink.download = fileNameToSaveAs;
    downloadLink.innerHTML = "Download File";
    downloadLink.href = window.webkitURL.createObjectURL(textFileAsBlob);
    downloadLink.click();
}

window.onload = main;