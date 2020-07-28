// import {NeedlemanWunschWebGL} from "/js/nw.js";
// import {NWSimpleSingleBuffer} from "/js/simple-nw.js"

function benchmark(shaderSources) {
    addResultsToPage(singleBenchmark(200, shaderSources));
    addResultsToPage(singleBenchmark(1000, shaderSources));
    addResultsToPage(singleBenchmark(10000, shaderSources));

    let spinner = document.querySelector("#spinner")
    document.body.removeChild(spinner);

    const dummyCanvas = document.createElement('canvas');
    const tempWebGL = dummyCanvas.getContext('webgl');
    document.querySelector("#heading").insertAdjacentHTML('afterend', `<div>${navigator.userAgent}, MAX_TEXTURE_SIZE = ${tempWebGL.getParameter(tempWebGL.MAX_TEXTURE_SIZE)}, MAX_TEXTURE_UNITS = ${tempWebGL.getParameter(tempWebGL.MAX_TEXTURE_IMAGE_UNITS)}</div>`);
}

function addResultsToPage(results) {
    debugMsg(`Finished benchmark ${results.n}`);
    let table = document.getElementById("table-body");
    let out = "";
    // out += `<tr><td>CPU Old</td><td>${results.cpuOld.toFixed(2)}</td></tr>`;
    out += `<tr><td>CPU New</td><td>${results.cpuNew.toFixed(2)}</td></tr>`;
    out += `<tr><td>GPU Init</td><td>${results.gpuInit.toFixed(2)}</td></tr>`;
    out += `<tr><td>GPU Query</td><td>${results.gpuQuery.toFixed(2)}</td></tr>`;
    out += `<tr><td>Matches</td><td>${results.matches}/${results.n}</td></tr>`;
    out += `<tr></tr>`;
    table.innerHTML += out;
}

function singleBenchmark(numFragments, shaderSources) {

    // let strings = [
    //     [19, 21, 30, 21, 21, 14, 19, 22, 24, 22],
    //     [23, 21, 11, 21, 21, 16, 19, 21, 23, 22],
    //     [19, 21, 33, 17, 20, 15, 19, 22, 24, 27],
    //     [10, 22, 30, 21, 19, 27, 26, 24, 22, 20],
    //     [21, 19, 30, 17, 17, 21, 14, 15, 12, 13],
    //     [14, 12, 30, 10, 17, 30, 21, 27, 26, 17]];
    // const query = [17, 30, 27, 26, 17];

    // let strings = [[10, 20, 70, 80]];
    // let query = [3, 4, 5, 6];

    // TODO investigate failure cases for lengths larger then 120 or so

    const query = random_array(80);
    let strings = [];
    for(let i = 0; i < numFragments; i++) {
        strings.push(random_array(40));
    }


    // let query = [11, 4, 4, 6, 2, 4, 3, 10, 9, 6, 4, 5, 3, 5, 9, 4, 9, 11, 3, 10];
    // let strings = []
    // let string = [2, 4, 0, 3, 4, 4, 2, 7, 3, 11, 3, 8, 2, 5, 10, 2, 3, 10, 11, 7];
    // for(let i = 0; i < 100; i++) {
    //     strings.push(string);
    // }

    let start;

    // =========================================================================

    // start = performance.now();
    // console.time('Old CPU Query');

    // let cpuScoresOld = [];
    // for(let i = 0; i < strings.length; i++) {
    //     let nw = new NeedlemanWunsch(query, strings[i], 2, -2, -1, false);
    //     let score = nw.getAlignmentScore();
    //     cpuScoresOld.push(score);
    // }

    // console.timeEnd('Old CPU Query');
    // let cpuOldTime = performance.now() - start;

    // =========================================================================

    start = performance.now();
    console.time('New CPU Query');

    let cpuScores = [];
    for(let i = 0; i < strings.length; i++) {
        let score2 = NWSimpleSingleBuffer(query, strings[i]);
        cpuScores.push(score2);
    }

    console.timeEnd('New CPU Query');
    let cpuNewTime = performance.now() - start;

    // =========================================================================

    debugMsg('initialising GPU');
    start = performance.now();
    console.time('GPU Initialise');

    const nw = new NeedlemanWunschWebGL(strings, shaderSources);

    console.timeEnd('GPU Initialise');
    let gpuInit = performance.now() - start;

    // =========================================================================

    debugMsg('querying GPU');
    start = performance.now();
    console.time('GPU Query');

    let gpuScores = nw.execute(query);

    console.timeEnd('GPU Query');
    let gpuQuery = performance.now() - start;

    // =========================================================================


    // Assess performance
    let matches = 0;
    for(let i = 0; i < strings.length; i++) {
        if(cpuScores[i] === gpuScores[i]) {
            matches += 1;
        } else {
            // console.warn('Query', query);
            console.warn('Index', i);
            // console.warn(strings[i], gpuScores[i], cpuScores[i]);
        }
    }

    let failures = strings.length - matches;
    if(failures > 0) {
        console.warn(cpuScores);
        // console.warn(cpuScoresOld);
        console.warn(gpuScores);
        console.error('Found ', failures.toString(), ' failures out of ' , strings.length.toString())
    } else {
        // console.info(cpuScores);
        // console.info(cpuScoresOld);
        // console.info(gpuScores);
        console.info('All strings processed with matching scores (', strings.length.toString(), ')');
    }

    return {
        // cpuOld: cpuOldTime,
        cpuNew: cpuNewTime,
        gpuInit: gpuInit,
        gpuQuery: gpuQuery,
        matches: matches,
        n: numFragments
    };
}

function random_array(l) {
    let arr = [];
    for(let i = 0; i < l; i++) {
        arr.push(Math.floor(12*Math.random()));
    }
    return arr;
}

function debugMsg(msg) {
    // document.body.innerHTML += "<br>";
    // document.body.innerHTML += msg;
}


// Old iOS doesn't support async / await keywords ...
function fetchShaderSources() {
    return new Promise(resolve => {
        Promise.all([
            fetch('shaders/vertexShader.glsl').then(value => value.text()),
            fetch('shaders/nwFragmentShader.glsl').then(value => value.text())
        ]).then((responses) => {
            resolve({ vertexShader: responses[0], fragmentShader: responses[1] });
        }).catch((err) => {
            console.log(err);
        });
    });

    // const responseV = await fetch();
    // const sourceV = await responseV.text();
    // const responseF = await fetch();
    // const sourceF = await responseF.text();
    // return { vertexShader: sourceV, fragmentShader: sourceF };
}

window.addEventListener("load", () => {
    debugMsg("loaded");
    fetchShaderSources().then(shaderSources => {
        try {
            benchmark(shaderSources);
        } catch (e) {
            debugMsg(`${e}, ${e.stack}`);
            alert(e);
        }
    });
});
