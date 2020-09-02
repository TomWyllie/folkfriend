let decoder, queryEngine, abcConverter;

function main() {
    queryEngine = new QueryEngineGPU();
    queryEngine.initialise().catch(console.error);
    decoder = new FeatureDecoder();
    abcConverter = new ABCConverter();

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

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');


    let t0 = performance.now();
    for(let i = 0; i < slices.data.length; i++) {

        let sliceURL = `/dataset/${slices.data[i].path}`;
        let sliceURLPng = sliceURL.replace(".wav", ".png");

        let img = new Image();
        img.src = sliceURLPng;
        await new Promise(resolve => {img.onload = resolve});

        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0 );

        let denoisedFramesSparse = [];
        let denoisedFrame = new Uint8ClampedArray(img.height);

        for(let x = 0; x < img.width; x++) {
            let denoisedFrameRGBA = context.getImageData(x, 0, 1, img.height);

            for(let y = 0; y < img.height; y++) {
                // Extract only one channel as image is grayscale
                denoisedFrame[y] = denoisedFrameRGBA.data[4 * y];
            }

            // TODO parameterise that 5
            let sparseIndices = topK(denoisedFrame, 5);
            denoisedFramesSparse.push(sparseIndices);
        }

        console.time("decode");
        const featureContour = contourBeamSearch(denoisedFramesSparse);
        const transcription = decoder.decode(featureContour);

        let score;
        if(transcription !== false) {
            transcription.abc = abcConverter.decodedToAbc(transcription.decoded);

            console.timeEnd("decode");

            if(FFConfig.debug) {
                console.debug(transcription);
            }

            console.time("query");
            let results = await queryEngine.query(transcription.decoded).catch(console.error);
            console.timeEnd("query");

            if(FFConfig.debug) {
                console.debug(results);
            }

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
            score = tunesRanking.hasOwnProperty(groundTruth) ? tunesRanking[groundTruth] : results.length;
        } else {
            // Silence. Give this the worst score.
            // TODO store this value somewhere else
            score = 100;
        }

        let dataLine = `${slices.data[i].path},${score}\n`;
        textOutput.textContent += dataLine;
        textOutput.scrollTop = textOutput.scrollHeight

        console.info(dataLine);

        let perf = (performance.now() - t0) / (1 + i);
        perf = Math.round(1000 * perf) / 1000;
        let minutesRemaining = perf * (slices.data.length - i - 1) / 60000;
        minutesRemaining = Math.round(100 * minutesRemaining) / 100;
        progressInfo.textContent = `Progress: ${i} / ${slices.data.length}, 
        at ${perf}ms per tune, (${minutesRemaining} minutes remaining)`;
    }
}

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