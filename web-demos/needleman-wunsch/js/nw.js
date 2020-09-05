// webgl_support = function() {
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

    constructor(strings, shaderSources) {
        this.canvas = document.createElement('canvas');

        gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');


        this.MAX_WEBGL_TEXTURE_SIZE = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
        this.MAX_WEBGL_NUM_TEXTURES = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) || 8;

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
        console.time("initialiseStringTextures");
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
        console.timeEnd("initialiseStringTextures");
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

        console.time("Binding texture partition");

        gl.activeTexture(gl.TEXTURE3 + partition.partitionNum);
        gl.bindTexture(gl.TEXTURE_2D, partition.texture);
        gl.uniform1i(this.uStringsSampler, 3 + partition.partitionNum);
        gl.activeTexture(gl.TEXTURE2);

        console.timeEnd("Binding texture partition");

        const [ computeTextures, frameBuffers ] = this.initialisePingPongBuffers();

        // Ping-pong texture
        gl.uniform1i(this.uNumFragments, this.nextPartitionSize);
        gl.uniform1i(this.uPingPongSampler, 2);

        let pingState = true;

        // let debugPixels = new Uint8Array(4 * this.nextPartitionSize * this.diagWidth);
        // let debugPixels = new Uint8Array(4 * this.diagWidth);

        console.time("Drawing buffers");

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

        console.timeEnd("Drawing buffers");

        console.time("Reading data back from GPU");

        // let pixels = new Uint8Array(4 * this.nextPartitionSize * this.diagWidth);
        // gl.readPixels(0, 0, this.diagWidth, this.nextPartitionSize, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        // console.log(pixels);
        let pixels = new Uint8Array(4 * this.nextPartitionSize);
        gl.readPixels(0, 0, 1, this.nextPartitionSize, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

        console.timeEnd("Reading data back from GPU");

        return pixels;
    }
}
