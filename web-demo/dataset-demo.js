// Run this script using NodeJS (14).
const ffQueryEngine = require("./js/ff-query-engine");
const ffTranscriber = require("./js/ff-transcriber");
const Papa = require('papaparse');
const Jimp = require("jimp");
const fs = require('fs');

let transcriber, queryEngine;
const rootURL = "http://localhost:8080";

async function main() {
    // Because these resources are loaded over HTTP rather than through the local file
    //  system there still needs to be a local `http-server` running.
    transcriber = new ffTranscriber.Transcriber(rootURL);

    // Getting WebGL to work in NodeJS with custom shaders is utterly horrifying.
    //  I managed to get as far as this message:
    /*
        node: symbol lookup error: /home/tom/repos/folkfriend/node_modules/gl/build/Release/webgl.node: undefined symbol: _Z15XextFindDisplayP15_XExtensionInfoP9_XDisplay
     */
    // And have now given up, resorting to CPU.

    // queryEngine = new ffQueryEngine.QueryEngineGPU(rootURL);
    queryEngine = new ffQueryEngine.QueryEngineCPU(rootURL);
    await queryEngine.initialise();

    await datasetDemo();
}

async function datasetDemo() {

    const settingsToTunes = await getSettingsToTunes();

    const recordings = await loadCSV(`./dataset/recordings.csv`);
    const recordingsToTunes = {}
    for(let i = 0; i < recordings.data.length; i++) {
        recordingsToTunes[recordings.data[i].path] = recordings.data[i]["thesession-id"];
    }

    const slices = await loadCSV(`./dataset/slices.csv`);
    const slicesToTunes = {}
    for(let i = 0; i < slices.data.length; i++) {
        slicesToTunes[slices.data[i].path] = recordingsToTunes[
            slicePathToRecordingPath(
                slices.data[i].path
            )
        ];
    }

    let t0 = Date.now();
    for(let i = 0; i < slices.data.length; i++) {

        // We already used python to convert the .wav slices to .pngs.
        //  This meant we didn't need to mess around with WebAudio in NodeJS.
        //  The results are almost pixel to pixel identical with only some
        //  slight differences due to numerical precision / minutely different
        //  windowing etc.

        let sliceURLWav = `${rootURL}/dataset/${slices.data[i].path}`;
        let sliceURLPng = sliceURLWav.replace(".wav", ".png");

        // Now we have to decode the PNG ourselves and insert the data from each frame
        //  into transcriber.featureExtractor.framesQueue

        const img = await Jimp.read(sliceURLPng);

        transcriber.featureExtractor.flush();

        for(let j = 0; j < img.bitmap.width; j++) {
            // Float32 make tensorflow's tensors float32
            let frame = new Float32Array(img.bitmap.height);
            for(let k = 0; k < img.bitmap.height; k++) {
                frame[k] = Jimp.intToRGBA(img.getPixelColor(j, k)).r
            }
            transcriber.featureExtractor.framesQueue.push(frame);
        }

        // console.time("transcribe");
        transcriber.featureExtractor.closed = true;
        await transcriber.featureExtractor.bulkProceed();
        const decoded = await transcriber.decode();
        // console.timeEnd("transcribe");

        // console.time("query");
        let results = await queryEngine.query(decoded.decoded).catch(console.error);
        // console.timeEnd("query");

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

        let dataLine = `${slices.data[i].path},${score}`;
        console.info(dataLine);

        let perf = (Date.now() - t0) / (1 + i);
        perf = Math.round(1000 * perf) / 1000;
        let minutesRemaining = perf * (slices.data.length - i - 1) / 60000;
        minutesRemaining = Math.round(100 * minutesRemaining) / 100;
        let updateInfo = `Progress: ${i} / ${slices.data.length}, at ${perf}ms per tune, (${minutesRemaining} minutes remaining)`;
        console.info(updateInfo)
    }
}

async function getSettingsToTunes() {
    const tunes = await loadCSV(`./dataset/tunes.csv`);
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
    const file = fs.readFileSync(CSV, 'utf8');
    return new Promise(resolve => {
        Papa.parse(file, {
            dynamicTyping: true,
            header: true,
            skipEmptyLines: true,
            complete: resolve
        });
    });
}

main().catch(console.error);