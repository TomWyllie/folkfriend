// webgl_support = function() {
//     try {
//         let canvas = document.createElement('canvas');
//         return !!window.WebGLRenderingContext &&
//         (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
//     } catch(e) {
//         return false;
//     }
// };

FRAGMENT_LENGTH = 64;

class QueryEngineGPU {
    // noinspection JSUnusedLocalSymbols
    constructor(vertexShaderSource, fragmentShaderSource, fragment) {
        this.vertexShaderSource = vertexShaderSource;
        this.fragmentShaderSource = fragmentShaderSource;

        // Dummy data of [1, 2, 3, ..., 63]
        let dummyFragment = [];
        for(let i = 0; i < FRAGMENT_LENGTH; i++) {
            dummyFragment.push(i);
        }
        this.fragment = this.queryToImgData(dummyFragment);
        // this.fragment = fragment;

        this.pingPongBuffers = [];
        this.pingPongTextures = [];
        this.pingPongState = false;
    }

    initialise() {
        this.canvas = document.createElement('canvas');
        // this.canvas.width = this.fragment.width;
        this.canvas.width = 4 * this.fragment.width;
        this.canvas.height = this.fragment.height;
        this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
        const gl = this.gl;

        // Compile and initialise shaders and program from source GLSL files
        const vertexShader = this.createShader(gl.VERTEX_SHADER, this.vertexShaderSource);
        const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, this.fragmentShaderSource);
        this.program = this.createProgram(vertexShader, fragmentShader);

        // Clear the canvas
        gl.clearColor(127.0/255.0, 127.0/255.0, 0, 0);

        // Debugging
        // console.debug(this.fragment.width);
        // console.debug(this.fragment.height);
        // gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        // document.body.appendChild(this.canvas);

        gl.useProgram(this.program);

        // Set up core WebGL components, including vertices and the ping
        //  pong buffers.
        this.setupPositionBuffer();
        this.setupPingPongTextures();
        this.clearPingPongTextures();

        // Load in some global constants
        this.setUniform("fragmentLength", FRAGMENT_LENGTH);

        if(this.canvas.width % FRAGMENT_LENGTH !== 0) {
            throw `Canvas width / Fragment length mismatch (${this.canvas.width}, ${FRAGMENT_LENGTH})`
        }

        this.setUniform("fragmentsX", this.canvas.width / FRAGMENT_LENGTH);
        this.setUniform("fragmentsY", this.canvas.height);

        // Set up samplers so we can access data from textures

        // TEXTURE      ID
        // Ping pong    0
        // Query        1
        // Fragments    2

        gl.activeTexture(gl.TEXTURE0);
        this.pingPongSampler = gl.getUniformLocation(this.program, "lastStage");
        gl.uniform1i(this.pingPongSampler, 0);

        this.setupDataTexture(this.fragment, "fragments", 2)
    }

    execute(query) {
        console.log("Execute");
        const gl = this.gl;

        this.setUniform("queryLength", query.length);
        const queryImgData = this.queryToImgData(query);
        this.setUniform("queryImgDataLength", queryImgData.length);
        this.setupDataTexture(queryImgData, "query", 1);

        const numStages = query.length + FRAGMENT_LENGTH - 1;

        gl.activeTexture(gl.TEXTURE0);
        let uniforms;

        for(let stage = 1; stage <= numStages; stage++) {
            let i = this.pingPongState ? 1 : 0;

            // Update various offsets that have changed on this iteration
            uniforms = this.getShaderUniforms(query.length, FRAGMENT_LENGTH, stage);
            console.log(uniforms);
            this.setShaderUniforms(uniforms);

            // Calculate next frame
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.pingPongBuffers[i]);
            gl.bindTexture(gl.TEXTURE_2D, this.pingPongTextures[1 - i]);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            this.pingPongState = !this.pingPongState;


            // Debugging
            let pixels = new Uint8Array(uniforms.length * 4);
            gl.readPixels(0, 0, uniforms.length, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
            // gl.readPixels(0, 0, 1, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

            let rChannel = [];
            for(let i = 0; i < pixels.length; i+=4) {
                rChannel.push(pixels[i]);
            }
            console.log(rChannel);
        }
    }

    queryToImgData(query) {
        // Query is an array of values between the range of notes that
        //  the FolkFriend backend can output.
        // We'll store consecutive values as R,G,B,A,R,G,B,A,R,G,B...
        // We'll also pad out with zeros to a power of two size
        //  to keep WebGL happy

        let numPixels = Math.max(1, Math.pow(2, Math.ceil(Math.log2(query.length / 4))));
        let pixels = new Uint8ClampedArray(4 * numPixels);
        pixels.fill(0);

        for(let i = 0; i < query.length; i++) {
            // This factor of four is unimportant.
            //  TODO we should take it out, it just maxes the
            //  range of values bigger and easier to see in the
            //  input PNG file.
            pixels[i] = 4 * query[i];
        }

        return new ImageData(pixels, numPixels, 1);
    }

    setupPositionBuffer() {
        const gl = this.gl;
        const program = this.program;

        // Set up position sampler
        let positionAttributeLocation = gl.getAttribLocation(program, "clipSpacePosition");

        // Generate vertices for a simple rectangle
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        const vertices = [
             1,  1,     // Top Right
            -1,  1,     // Top Left
             1, -1,     // Bottom Right
            -1, -1      // Bottom Left
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        // Turn attribute on
        gl.enableVertexAttribArray(positionAttributeLocation);

        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.vertexAttribPointer(positionAttributeLocation, 2,
            gl.FLOAT, false, 0, 0);

    }

    setupPingPongTextures() {
        const gl = this.gl;
        // Set up our ping-pong textures
        for (let i = 0; i < 2; i++) {
            let tex = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, tex);
            gl.texImage2D(
                gl.TEXTURE_2D, 0, gl.RGBA,
                this.canvas.width,
                this.canvas.height,
                0, gl.RGBA, gl.UNSIGNED_BYTE,
                null    // No data to start with
            );

            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

            let fb = gl.createFramebuffer();
            fb.width = this.canvas.width;
            fb.height = this.canvas.height;

            gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

            this.pingPongTextures.push(tex);
            this.pingPongBuffers.push(fb);
        }
    }

    clearPingPongTextures() {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.pingPongBuffers[0]);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.pingPongBuffers[1]);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }

    setupDataTexture(data, name, id) {
        const gl = this.gl;
        const tex = gl.createTexture();
        const sampler = gl.getUniformLocation(this.program, name);
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, data);

        gl.uniform1i(sampler, id);
        return {tex: tex, sampler: sampler}
    }

    getShaderUniforms(queryLength, fragmentLength, stage) {
        /*
        The only parameters that matter from the shader's point of view are
         - The length of the alignment buffer
         - Whether or not the first index in the alignment buffer corresponds
             to a value on the top edge of the alignment matrix, or the right
             side edge.
         - Whether or not the last index in the alignment buffer corresponds
             to a value on the left side edge of the alignment matrix, or the
             bottom edge.
         - The index offset for accessing a value from the alignment buffer
             that was calculated at time t-1 (the last step). Use the cell
             on the left as the reference for zero offset.
         - The index offset for accessing a value from the alignment buffer
             that was calculated at time t-2 (the step before last).
         - The index offset for accessing a value from the query data
         - The index offset for accessing a value from the fragment data

        All of these parameters are a function only of the following parameters:
         - Query length
         - Fragment length
         - Alignment stage (which diagonal we are currently on)

        Let's take this slowly and look through a few examples.

        queryLength: 4
        fragmentLength: 4
        stage: 2

        X = cells represented by the alignment buffer at this stage
        O = other cells

                Index 0 starts here
              ↙ ️
        O↖O X O
        O￩X O O
        X O O O
        O O O O

        length = 3,             there are Xs shown in the diagram.
        firstIndexTop = yes,    the arrow starts pointing to the top row
        lastIndexBottom = no,   the last X is on the left side not the bottom

        Now look at X in index 1 (ie one cell between it and the top or right
        edge, traversed diagonally), with arrows shown. Call this cell A.
        The cell immediately to the left is in index 1 on its own diagonal
        and so is cell A. Therefore;

        tMinusOneOffset = 0

        Looking at the upper left pointing arrow from cell A, we see the top
        left entry is at index 0 on its diagonal, therefore to reference it
        from cell A (index 1) we need to subtract one from the index;

        tMinusTwoOffset = -1

        The edge indices will be handled before reaching this step and will be
        computed differently, so it doesn't matter that there is, for example,
        no cell above and to the left of the cell in index 0 of the diagonal
        shown. This would correspond to index 0 + tMinusTwoOffset = -1 of the
        stage = 1, which is out of bounds (that cell doesn't exist in the matrix).

        Every offset is the same for all values in a diagonal line.

        The choice of which axis is the query and which is the fragment is
        insignificant as the final value will be taken as the bottom right
        entry either way, which remains the same under transposition. We
        arbitrarily choose to run the fragment along the top and the query
        down the side;

        <-- fragment length -->
        /\
        |
        query length
        |
        \/

        The cell in index 0 of the buffer shown therefore corresponds to
        fragment array index 2 and query array index 0;

        fragmentOffset = 2      (and is always traversed negatively, ie step = -1)
        queryOffset = 0         (and is always traversed positively, ie step =  1)


        Let's start to generalise these variables one by one.

        Let's look at the lengths first. Consider;

        queryLength: 5
        fragmentLength: 9

        A B C D E F G H I
        B C D E F G H I J
        C D E F G H I J K
        D E F G H I J K L
        E F G H I J K L M

        The lengths at each stage are

            [1, 2, 3, 4, 5, 5, 5, 5, 5, 4, 3, 2, 1]

        Note that because each step right or down always moves us onto the next
        diagonal, there are queryLength + fragmentLength - 1 steps required to
        move from the first cell (the single A) to the last (the single M).

        If you like thinking about it like this, just assure yourself that
        M is the 13th letter of the alphabet and there are therefore 13
        diagonals, and thus 13 steps.

        There are therefore queryLength + fragmentLength - 1 stages in total.

        In general, the rule for the lengths is as follows;

        Denote min(query length, fragment length) as MIN
        Denote max(query length, fragment length) as MAX
        Denote query length + fragment length - 1
            (or equivalently MIN + MAX - 1) as END
        Denote stage index as N, and this is ONE INDEXED

        For stages [1, MIN), length = N
        For stages [MIN, MAX), length = MIN
        For stages [MAX, END], length = MIN + MAX - N

        Try this for a few of the values in the above matrix to convince yourself.

        Note that the middle stage may have a range of zero,
            iff MIN = MAX iff query length = fragment length

        For example

            A B C D
            B C D E
            C D E F
            D E F G

        Has lengths [1, 2, 3, 4, 3, 2, 1]
                    |_______||__________|
                    length=N length=MIN+MAX-N

        The "edge case flags" firstIndexTop and lastIndexBottom are fairly
        straightforward to devise rules for, the zero index is clearly in the top row
        for all stages [1, fragment length], else it is on the right hand side.
        Similarly the last index (the index-value of which is determined as length - 1)
        is on the left side for all stages [1, query length], else it is on the
        bottom edge.

        tMinusOneOffset and tMinusTwoOffset are less straightforward.
        Firstly it should be noted that
        this offset is used both for finding the left neighbour cell and the top
        neighbour cell. This because for some cell C, its left neighbour and top
        neighbour are diagonally next to each other, that is they will be stored
        side-by-side in the alignment buffer, both on the diagonal immediately
        before the diagonal of the cell C.

        Consider an alignment matrix of the same dimensions as earlier

        A B C D E F G H I
        B C D E F G H I J
        C D E F G H I J K
        D E F G H I J K L
        E F G H I J K L M

        Remember, tMinusOneOffset is essentially answering the question,
            "If I'm in a cell at index X on its diagonal and I take a step
             left onto a cell at index Y on its diagonal, what is Y - X?"

        In the example above,
            tMinusOneOffset: [*, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1]

        Remember, tMinusTwoOffset is essentially answering the question,
            "If I'm in a cell at index X on its diagonal and I take a step up AND
             left onto a cell at index Y on its diagonal, what is Y - X?"

        In the example above,
            tMinusTwoOffset: [*, *, -1, -1, -1, -1, -1, -1, -1, 0, 1, 1, 1]

        Now consider the example

        queryLength: 7
        fragmentLength: 3

        A B C
        B C D
        C D E
        D E F
        E F G
        F G H
        G H I

        In this example (9 stages),
            tMinusOneOffset: [*, 0, 0, 1, 1, 1, 1, 1, 1]
            tMinusTwoOffset: [*, *, -1, 0, 1, 1, 1, 1, 1]

        If these examples are clear to you, hopefully it should be clear that this
        generalises to

        For stages [2, fragment length],    tMinusOneOffset = 0
        For stages (fragment length, END],  tMinusOnfOffset = 1

        For stages [3, fragment length],                    tMinusTwoOffset = -1
        For stage  (fragment length, fragment length + 1],  tMinusTwoOffset = 0
        For stages (fragment length + 1, END]               tMinusTwoOffset = 1

        Finally we consider fragmentOffset and queryOffset.
        Consider an alignment matrix of the same dimensions as earlier

        A B C D E F G H I
        B C D E F G H I J
        C D E F G H I J K
        D E F G H I J K L
        E F G H I J K L M

        fragmentOffset: [0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 8, 8, 8]
        queryOffset:    [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4]

        This generalises to
            For all N: fragmentOffset = min(stage, fragment length)
            For all N: queryOffset    = max(0, stage - fragment length)

        And there we have it! We simply pass all of these variables into our
        parallel program at each stage and iterate the next alignment buffer
        computation step, which can compute the diagonal values in parallel.

         */


        const min = Math.min(queryLength, fragmentLength);
        const max = Math.max(queryLength, fragmentLength);
        const end = min + max - 1;

        let length, firstIndexTop, lastIndexBottom, tMinusOneOffset, tMinusTwoOffset, queryOffset, fragmentOffset;

        firstIndexTop = stage <= fragmentLength;
        lastIndexBottom = stage > queryLength;

        if(stage >= 1 && stage < min) {
            length = stage;
        } else if(stage >= min && stage < max) {
            length = min;
        } else if(stage >= max && stage <= end) {
            length = min + max - stage;
        } else {
            throw `Invalid Stage ${stage}`
        }

        if(stage <= fragmentLength) {
            tMinusOneOffset = 0;
        } else if(stage > fragmentLength && stage <= end) {
            tMinusOneOffset = 1;
        } else {
            throw `Invalid Stage ${stage}`
        }

        if(stage <= fragmentLength) {
            tMinusTwoOffset = -1;
        } else if(stage === fragmentLength + 1) {
            tMinusTwoOffset = 0;
        } else if(stage > fragmentLength + 1 && stage <= end) {
            tMinusTwoOffset = 1;
        } else {
            throw `Invalid Stage ${stage}`
        }

                // For all N: fragmentOffset = min(stage, fragment length)
            // For all N: queryOffset    = max(0, stage - fragment length)
        fragmentOffset = Math.min(stage, fragmentLength);
        queryOffset = Math.max(0, stage - fragmentLength);

        return {
            "length": length,
            "firstIndexTop": firstIndexTop,
            "lastIndexBottom": lastIndexBottom,
            "tMinusOneOffset": tMinusOneOffset,
            "tMinusTwoOffset": tMinusTwoOffset,
            "fragmentOffset": fragmentOffset,
            "queryOffset": queryOffset
        }
    }

    setShaderUniforms(uniforms) {
        Object.keys(uniforms).forEach((key) => {
            this.setUniform(key, uniforms[key]);
        });
    }

    setUniform(name, value) {
        let loc = this.gl.getUniformLocation(this.program, name);
        this.gl.uniform1i(loc, value);
    }

    createProgram(vertexShader, fragmentShader) {
        // https://webglfundamentals.org/webgl/lessons/webgl-fundamentals.html
        const gl = this.gl;
        const program = gl.createProgram();

        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        const success = gl.getProgramParameter(program, gl.LINK_STATUS);
        if (success) {
            return program;
        }
        console.error(gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
    }

    createShader(type, source) {
        const gl = this.gl;

        // https://webglfundamentals.org/webgl/lessons/webgl-fundamentals.html
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
        if (success) {
            return shader;
        }
        console.error(type === gl.VERTEX_SHADER ? "VERTEX" : "FRAGMENT",
            gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);

    }
}