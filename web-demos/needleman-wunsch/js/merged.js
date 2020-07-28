// import {NeedlemanWunschWebGL} from "/js/nw.js";
// import {NWSimpleSingleBuffer} from "/js/simple-nw.js"

function benchmark(shaderSources) {
    // addResultsToPage(singleBenchmark(200, shaderSources));
    // addResultsToPage(singleBenchmark(1000, shaderSources));
    // addResultsToPage(singleBenchmark(10000, shaderSources));
    // addResultsToPage(singleBenchmark(100000, shaderSources));

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
    document.body.innerHTML += "<br>";
    document.body.innerHTML += msg;
}


async function fetchShaderSources() {
    const responseV = await fetch('shaders/vertexShader.glsl');
    const sourceV = await responseV.text();

    const responseF = await fetch('shaders/nwFragmentShader.glsl');
    const sourceF = await responseF.text();

    return { vertexShader: sourceV, fragmentShader: sourceF };
}

window.addEventListener("load", () => {
    alert("LOADED!");
    debugMsg("loaded");
    fetchShaderSources().then(shaderSources => {
        // try {
        benchmark(shaderSources);
        // } catch (e) {
        //     debugMsg(e);
        //     alert(e);
        // }
    });
});
class NeedlemanWunsch {
    /*
        Javascript implementation of the Needleman–Wunsch algorithm for global sequence alignment.
        Based on:
            https://en.wikipedia.org/wiki/Needleman%E2%80%93Wunsch_algorithm
            http://biopython.org/DIST/docs/api/Bio.pairwise2-module.html
     */

    constructor(seqA, seqB, matchScore, mismatchScore, linearGapPenalty, penaliseEndGaps) {
        this._seqA = seqA;
        this._seqB = seqB;

        // seqA down side of matrix, seqB along top. Buffer stores matrix as
        //  (*row_0, *row_1, ..., *row_n)
        this._rows = this._seqA.length + 1;
        this._cols = this._seqB.length + 1;
        this._buffer = new Int16Array(this._cols * this._rows);

        this._matchScore = matchScore;
        this._mismatchScore = mismatchScore;

        // Penalising end gaps is baked into algorithm for speed gains
        if(penaliseEndGaps) {
            throw "Penalising end gaps is not supported"
        }

        this._linearGapPenalty = linearGapPenalty;

    }

    getAlignmentScore() {
        const firstAGap = this._linearGapPenalty;
        const firstBGap = this._linearGapPenalty;

        /*
        // To begin with, initialise first row and column with gap scores. This is like opening up
        //  i gaps at the beginning of sequence A or B.
        if(this._penaliseEndGaps) {
            // TODO not used in folkfriend, could implement someday
            throw "Penalising end gaps is not supported"
        } else {
            // We need to fill the first row and columns with zero. Serendipitously Uint16Arrays are
            //  initialised with all values zero so we don't need to do anything here.
        }
        */

        // Now initialize the col 'matrix'. Actually this is only a one dimensional list, since at
        //  each step only the column scores from the previous row are used.
        let colScores = Array.from({length: this._seqB.length + 1}, (_, i) => NeedlemanWunsch._calcAffinePenalty(i, this._linearGapPenalty));
        colScores[0] = 0;

        // Move these steps out of loop to save re-allocating many times.
        let rowOpen; let rowExtend;
        let colOpen; let colExtend;
        for(let row = 1; row < this._seqA.length + 1; row++) {
            let rowScore = NeedlemanWunsch._calcAffinePenalty(row, this._linearGapPenalty);
            for(let col = 1; col < this._seqB.length + 1; col++) {
                // Calculate the score that would occur by extending the alignment without gaps.
                let noGapScore = this._getScore(row - 1, col - 1) + this._computePairwiseScore(this._seqA[row - 1], this._seqB[col - 1]);

                // Check score that would occur if there were a gap in sequence A, either from opening a new one
                //  or extending an existing one.
                if(row === this._seqA.length) {
                    rowOpen = this._getScore(row, col - 1);
                    rowExtend = rowScore;
                } else {
                    rowOpen = this._getScore(row, col - 1) + firstAGap;
                    // console.log(this._getScore(row, col - 1));
                    // console.log(this._buffer);
                    rowExtend = rowScore + this._linearGapPenalty;
                }
                rowScore = Math.max(rowOpen, rowExtend);

                if(col === this._seqB.length) {
                    colOpen = this._getScore(row - 1, col);
                    colExtend = colScores[col];
                } else {
                    colOpen = this._getScore(row - 1, col) + firstBGap;
                    colExtend = colScores[col] + this._linearGapPenalty;
                }
                colScores[col] = Math.max(colOpen, colExtend);


                let bestScore = Math.max(noGapScore, colScores[col], rowScore);
                this._setScore(row, col, bestScore);
            }
        }

        // For debugging
        // this._logMatrix();

        // Return last entry in score matrix
        return this._getScore(this._rows - 1, this._cols - 1);
    }

    _setScore(row, col, score) {
        this._buffer[row * this._cols + col] = score;
    }

    _getScore(row, col) {
        return this._buffer[row * this._cols + col];
    }

    _computePairwiseScore(a, b) {
        return a === b ? this._matchScore : this._mismatchScore;
    }

    // noinspection JSUnusedGlobalSymbols
    _logMatrix() {
        for(let row = 0; row < this._rows; row++) {
            let chunk = this._buffer.slice(row * this._cols, (row+1) * this._cols);
            console.log("(" + String(row) + ")", chunk.join('\t'));
        }
    }

    static _calcAffinePenalty(length, penalty) {
        return length <= 0 ? 0 : penalty * (length + 1);
    }
}// webgl_support = function() {
//     try {
//         let canvas = document.createElement('canvas');
//         return !!window.WebGLRenderingContext &&
//         (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
//     } catch(e) {
//         return false;
//     }
// };

let gl;

class NeedlemanWunschWebGL {
// export class NeedlemanWunschWebGL {
    MAX_WEBGL_NUM_TEXTURES = 32;
    // Actually 16384 on many machines but this is our highest guaranteed.
    MAX_WEBGL_TEXTURE_SIZE = 4096;

    constructor(strings, shaderSources) {
        this.canvas = document.createElement('canvas');

        gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');


        this.MAX_WEBGL_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE) || this.MAX_WEBGL_TEXTURE_SIZE;
        this.MAX_WEBGL_NUM_TEXTURES = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) || this.MAX_WEBGL_NUM_TEXTURES;

        this.strings = strings;
        this.fragmentLength = strings[0].length;
        this.numFragments = strings.length;
        this.partitions = this.allocatePartitions();
        this.nextPartitionSize = 0;

        // -3 Because we need one active texture each
        //  for query, rows/cols, ping-pong buffer
        if(this.partitions.length > this.MAX_WEBGL_NUM_TEXTURES - 3) {
            throw "Require numbered of partitions exceeds available active WebGL Textures";
        }

        this.fragmentShader = null;
        this.vertexShader = null;
        this.vPositionCompute = null;

        this.fragmentShader = this.loadShader(shaderSources.fragmentShader, gl.FRAGMENT_SHADER);
        this.vertexShader = this.loadShader(shaderSources.vertexShader, gl.VERTEX_SHADER);

        this.program = this.initialiseProgram();
        this.vertexBuffer = this.initialiseVertexBuffer();

        // Uniform textures that are constant
        this.uPingPongSampler = gl.getUniformLocation(this.program, "uPingPongSampler");
        this.uRowsAndColsSampler = gl.getUniformLocation(this.program, "uRowsAndCols");
        this.uStringsSampler = gl.getUniformLocation(this.program, "uStrings");
        this.uQuerySampler = gl.getUniformLocation(this.program, "uQuery");

        // Uniform scalars that are constant
        this.uQueryLength = gl.getUniformLocation(this.program, "queryLength");
        this.uFragmentLength = gl.getUniformLocation(this.program, "fragmentLength");
        this.uDiagLength = gl.getUniformLocation(this.program, "diagLength");
        this.uNumFragments = gl.getUniformLocation(this.program, "numFragments");
        this.uNumStages = gl.getUniformLocation(this.program, "numStages");

        // Uniform scalars that change on each iteration
        this.uStage = gl.getUniformLocation(this.program, "stage");
        this.uMaxIndex = gl.getUniformLocation(this.program, "maxIndex");
        this.uRelIndexAbove = gl.getUniformLocation(this.program, "relIndexAbove");
        this.uRelIndexLeft = gl.getUniformLocation(this.program, "relIndexLeft");
        this.uRelIndexAboveLeft = gl.getUniformLocation(this.program, "relIndexAboveLeft");

        // Varying attributes
        this.vPositionCompute = gl.getAttribLocation(this.program, "vPosition");
        gl.enableVertexAttribArray(this.vPositionCompute);

        gl.useProgram(this.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.vertexAttribPointer(this.vPositionCompute, 3, gl.FLOAT, false, 0, 0);

        // Create our partitioned strings textures as they are query-independent
        // TODO bind textures and load in now, only change sampler at query time
        // this.initialiseStringTextures();

        this.initialiseStringTextures();

        this.rowsColsTexture = 0;
        this.queryTexture = 0;

        // Query dependent variables that are assigned properly in execute()
        this.queryLength = 0;
        this.diagWidth = 0;
        this.indexData = [];
    }

    static async fetchShaderSources() {
        const responseV = await fetch('shaders/vertexShader.glsl');
        const sourceV = await responseV.text();

        const responseF = await fetch('shaders/nwFragmentShader.glsl');
        const sourceF = await responseF.text();

        return { vertexShader: sourceV, fragmentShader: sourceF };
    }

    loadShader(source, shaderType) {
        let shaderDesc;
        switch(shaderType) {
            case gl.FRAGMENT_SHADER: shaderDesc = "fragment shader"; break;
            case gl.VERTEX_SHADER: shaderDesc = "vertex shader"; break;
            default: throw "Invalid shader type";
        }

        const shader = gl.createShader(shaderType);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(`An error occurred compiling the ${shaderDesc}: ${gl.getShaderInfoLog(shader)}`);
        } else {
            console.log(`Shader compiled (${shaderDesc})`);
        }
        return shader;
    }

    allocatePartitions() {
        let numFragmentsAllocated = 0;
        let partitions = [];
        while(numFragmentsAllocated < this.numFragments) {
            let numFragmentsRemaining = this.numFragments - numFragmentsAllocated;
            let nextPartitionSize = Math.min(numFragmentsRemaining, this.MAX_WEBGL_TEXTURE_SIZE);
            partitions.push({
                start: numFragmentsAllocated,
                numPartitionedFragments: nextPartitionSize,
                partitionNum: partitions.length
            });
            numFragmentsAllocated += nextPartitionSize;
        }
        return partitions;
    }

    generateIndexData(queryLength, fragmentLength) {
        const totalStages = fragmentLength + queryLength;
        let indexData = [{
            rows: [0],
            cols: [0],
        }, {
            rows: [0, 1],
            cols: [1, 0],
        }];

        for (let stage = 2; stage <= totalStages; stage++) {

            // Calculate the indices along the diagonal for this stage.
            const rows = [];
            const cols = [];
            for (let i = 0; i <= stage; i++) {
                let row = i;
                let col = stage - i;
                if (row < queryLength + 1 && col < fragmentLength + 1) {
                    rows.push(row);
                    cols.push(col)
                }
            }

            const maxIndex = cols.length - 1;
            const startTop = rows[0] === 0;

            indexData.push({
                rows: rows,
                cols: cols,
                maxIndex: maxIndex,
                relIndexAbove: startTop ? -1 : 0,
                relIndexLeft: startTop ? 0 : 1,
                relIndexAboveLeft: rows[0] - indexData[stage - 2].rows[0] - 1
            });
        }

        // Remove the two entries we initialised with
        indexData.splice(0, 2);
        return indexData;
    }

    initialiseProgram() {
        const computeProgram = gl.createProgram();
        gl.attachShader(computeProgram, this.vertexShader);
        gl.attachShader(computeProgram, this.fragmentShader);
        gl.linkProgram(computeProgram);
        if (!gl.getProgramParameter(computeProgram, gl.LINK_STATUS)) {
            console.error("Unable to initialize the shader program.");
        } else {
            console.log("Initialized shader program");
        }
        return computeProgram;
    }
        
    initialiseVertexBuffer() {
        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        const vertices = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
        return vertexBuffer;
    }

    initialiseStringTextures() {
        for(let k = 0; k < this.partitions.length; k++) {
            const partition = this.partitions[k];
            const textureWidth = this.fragmentLength;
            const textureHeight = partition.numPartitionedFragments;
            const imgDataArray = new Uint8ClampedArray(4 * textureWidth * textureHeight);
            imgDataArray.fill(0);
            for(let i = 0; i < textureHeight; i++) {
                for(let j = 0; j < textureWidth; j++) {
                    imgDataArray[4 * (textureWidth * i + j)] = this.strings[partition.start + i][j];
                }
            }

            const stringTexture = this.initialiseTexture(imgDataArray, textureWidth, textureHeight);
            this.partitions[k].texture = stringTexture;
        }
    }

    initialisePingPongBuffers() {
        const initValues = new Uint8ClampedArray(4 * this.diagWidth * this.nextPartitionSize);
        initValues.fill(127);    // We're using unsigned values inside GLSL: 0 -> 127

        // TODO probably don't need to slice these
        const ping = initValues.slice();
        const pong = initValues.slice();
        const imgDataArrays = [ping, pong];

        let frameBuffers = [];
        let computeTextures = [];

        // Set up our ping-pong textures
        for (let i = 0; i < 2; i++) {
            let framebuffer = gl.createFramebuffer();
            framebuffer.width = this.canvas.width;
            framebuffer.height = this.canvas.height;
            gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
            let texture = this.initialiseTexture(imgDataArrays[i], this.diagWidth, this.nextPartitionSize);

            // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.diagWidth, this.nextPartitionSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

            frameBuffers.push(framebuffer);
            computeTextures.push(texture);
        }
        return [computeTextures, frameBuffers];
    }

    initialiseQueryConstants(query) {

        // Link texture and sampler for the uniform query object
        gl.activeTexture(gl.TEXTURE0);
        this.queryTexture = this.initialiseQueryTexture(query);
        gl.bindTexture(gl.TEXTURE_2D, this.queryTexture);
        gl.uniform1i(this.uQuerySampler, 0);

        // Link texture and sampler for the uniform rows / cols object
        gl.activeTexture(gl.TEXTURE1);
        this.rowsColsTexture = this.initialiseRowsColsTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.rowsColsTexture);
        gl.uniform1i(this.uRowsAndColsSampler, 1);

        // Shifting this texture focus away is very important apparently
        gl.activeTexture(gl.TEXTURE2);
        gl.uniform1i(this.uPingPongSampler, 2);

        // Uniform constant scalars
        gl.uniform1i(this.uQueryLength, this.queryLength);
        gl.uniform1i(this.uFragmentLength, this.fragmentLength);
        gl.uniform1i(this.uDiagLength, this.diagWidth);
        gl.uniform1i(this.uNumStages, this.indexData.length);
    }

    initialiseTexture(imgDataArray, width, height) {
        let texture = gl.createTexture();
        const imageData = new ImageData(imgDataArray, width, height);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageData);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return texture
    }

    initialiseRowsColsTexture() {
        const arr = new Uint8ClampedArray(4 * this.diagWidth * this.indexData.length);
        arr.fill(0);
        for(let i = 0; i < this.indexData.length; i++) {
            for(let j = 0; j < this.indexData[i].rows.length; j++) {
                arr[4 * (this.diagWidth * i + j)] = this.indexData[i].rows[j];
                arr[4 * (this.diagWidth * i + j) + 1] = this.indexData[i].cols[j];
            }
        }
        return this.initialiseTexture(arr, this.diagWidth, this.indexData.length);
    }
    
    initialiseQueryTexture(query) {
        const arr = new Uint8ClampedArray(4 * query.length);
        arr.fill(0);
        for(let i = 0; i < query.length; i++) {
            arr[4 * i] = query[i];
        }
        return this.initialiseTexture(arr, query.length, 1);
    }

    execute(query) {
        this.queryLength = query.length;
        this.diagWidth = Math.min(this.queryLength, this.fragmentLength) + 1;
        this.canvas.width = this.diagWidth;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        // Index data function only of query / fragment length and so unchanged
        //  across partitions.
        this.indexData = this.generateIndexData(this.queryLength, this.fragmentLength);

        // These are all also independent of the partition (but not of the query).
        this.initialiseQueryConstants(query);

        // let outputScores = new Float32Array(strings.length);
        let outputScores = new Uint8ClampedArray(this.numFragments);

        for(let i = 0; i < this.partitions.length; i++) {
            console.time('GPU Single Partition');
            let partitionScores = this.executeSinglePartition(query, this.partitions[i]);
            console.timeEnd('GPU Single Partition');

            for(let j = 0; j < partitionScores.length; j++) {
                // outputScores[this.partitions[i].start + j] = partitionScores[4 * j];
                outputScores[this.partitions[i].start + j] = partitionScores[4 * j] - 127;
                // outputScores[i] = pixels[4*i] / (2 * (diagWidth - 1));
            }
        }

        gl.flush();
        return outputScores
    }

    executeSinglePartition(query, partition) {
        this.nextPartitionSize = partition.numPartitionedFragments;

        this.canvas.height = this.nextPartitionSize;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        // TODO and uncommenting this breaks it...
        // Link texture and sampler for the uniform strings object.
        //  This is what varies with each partition, as we can't fit all 
        //  30,000 - 40,000 tunes from the session into a single texture without
        //  horizontal fragment stacking (which would probably be a mess).
        // gl.activeTexture(gl.TEXTURE1);
        // console.warn(partition);
        // gl.bindTexture(gl.TEXTURE_2D, partition.texture);
        // gl.uniform1i(this.uStringsSampler, 1);

        gl.activeTexture(gl.TEXTURE3 + partition.partitionNum);
        gl.bindTexture(gl.TEXTURE_2D, partition.texture);
        gl.uniform1i(this.uStringsSampler, 3 + partition.partitionNum);
        gl.activeTexture(gl.TEXTURE2);

        const [ computeTextures, frameBuffers ] = this.initialisePingPongBuffers();

        // Ping-pong texture
        gl.uniform1i(this.uNumFragments, this.nextPartitionSize);
        gl.uniform1i(this.uPingPongSampler, 2);

        let pingState = true;

        // let debugPixels = new Uint8Array(4 * this.nextPartitionSize * this.diagWidth);
        // let debugPixels = new Uint8Array(4 * this.diagWidth);

        for (let stage = 0; stage < this.indexData.length; stage++) {
            gl.uniform1i(this.uStage, stage);
            gl.uniform1i(this.uMaxIndex, this.indexData[stage].maxIndex);
            gl.uniform1i(this.uRelIndexAbove, this.indexData[stage].relIndexAbove);
            gl.uniform1i(this.uRelIndexLeft, this.indexData[stage].relIndexLeft);
            gl.uniform1i(this.uRelIndexAboveLeft, this.indexData[stage].relIndexAboveLeft);

            if (pingState) {
                // console.debug("Ping");
                gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffers[1]);
                gl.bindTexture(gl.TEXTURE_2D, computeTextures[0]);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            } else {
                // console.debug("Pong");
                gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffers[0]);
                gl.bindTexture(gl.TEXTURE_2D, computeTextures[1]);
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }
            pingState = !pingState;

            // gl.readPixels(0, 90, this.diagWidth, 1, gl.RGBA, gl.UNSIGNED_BYTE, debugPixels);
            // gl.readPixels(0, 0, this.diagWidth, this.nextPartitionSize, gl.RGBA, gl.UNSIGNED_BYTE, debugPixels);
            // let out = [];
            // for(let i = 0; i < this.diagWidth; i++) {
            //     out.push(debugPixels[4 * i])
            // }

            // console.log(out.join('\t'));
            // console.log(debugPixels);

        }

        // Avoid race condition - the gl.draw* commands are asynchronous.
        gl.finish();

        // let pixels = new Uint8Array(4 * this.nextPartitionSize * this.diagWidth);
        // gl.readPixels(0, 0, this.diagWidth, this.nextPartitionSize, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        // console.log(pixels);
        let pixels = new Uint8Array(4 * this.nextPartitionSize);
        gl.readPixels(0, 0, 1, this.nextPartitionSize, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        return pixels;
    }
}
function NWSimple(A, B) {
    const matchScore = 2;
    const mismatchScore = -2;
    const gapScore = -1;

    if(A.length > B.length) {
        let temp = A;
        A = B;
        B = temp;
    }

    let thisRow = new Int16Array(A.length + 1);
    let lastRow = new Int16Array(A.length + 1);
    lastRow.fill(0);

    //      A1 A2 A3 .. AN
    //   B1
    //   B2
    //   B3
    //   ..
    //   BN

    for(let row = 0; row < B.length; row++) {
        thisRow[0] = 0;
        for(let col = 1; col < thisRow.length; col++) {
            thisRow[col] = Math.max(
            // (A[col - 1] === B[row] ? 2 : -1),
            lastRow[col - 1] + (A[col - 1] === B[row] ? matchScore : mismatchScore),
                thisRow[col - 1] + gapScore,
                lastRow[col] + gapScore
            );
        }
        thisRow[thisRow.length - 1] = Math.max(thisRow[thisRow.length - 1], lastRow[lastRow.length - 1]);
        // console.log(lastRow.join('\t'));
        lastRow = thisRow.slice();
    }
    // console.log(lastRow.join('\t'));

    return Math.max(...lastRow);
}


function NWSimpleSingleBuffer(A, B) {
// export function NWSimpleSingleBuffer(A, B) {
    const matchScore = 2;
    const mismatchScore = -2;
    const gapScore = -1;

    if(A.length > B.length) {
        let temp = A;
        A = B;
        B = temp;
    }

    let lastRow = new Int16Array(A.length + 1);
    lastRow.fill(0);
    // console.log(lastRow.join('\t'));

    //      A1 A2 A3 .. AN
    //   B1
    //   B2
    //   B3
    //   ..
    //   BN

    lastRow[0] = 0;
    let lastDiag = 0;
    let currDiag = 0;
    for(let row = 0; row < B.length; row++) {
        lastDiag = 0;
        for(let col = 1; col < lastRow.length; col++) {
            currDiag = lastDiag;
            lastDiag = lastRow[col];

            // console.log(lastRow[col], currDiag, lastRow[col - 1]);

            lastRow[col] = Math.max(
            currDiag + (A[col - 1] === B[row] ? matchScore : mismatchScore),
                lastRow[col - 1] + gapScore,
                lastRow[col] + gapScore
            );
        }
        lastRow[lastRow.length - 1] = Math.max(lastRow[lastRow.length - 1], lastDiag);
        // thisRow[thisRow.length - 1] = Math.max(thisRow[thisRow.length - 1], lastRow[lastRow.length - 1]);
        // console.log(lastRow.join('\t'));
        // lastRow = thisRow.slice();
    }
    // console.log(lastRow);

    return Math.max(...lastRow);
}