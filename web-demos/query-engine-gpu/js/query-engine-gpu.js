// webgl_support = function() {
//     try {
//         let canvas = document.createElement('canvas');
//         return !!window.WebGLRenderingContext &&
//         (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
//     } catch(e) {
//         return false;
//     }
// };

FRAGMENT_SIZE = 64;

class QueryEngineGPU {
    constructor(vertexShaderSource, fragmentShaderSource, fragment) {
        this.vertexShaderSource = vertexShaderSource;
        this.fragmentShaderSource = fragmentShaderSource;
        this.fragment = fragment;
    }

    initialise() {
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.fragment.width;
        this.canvas.height = this.fragment.height;
        console.debug(this.fragment.width);
        console.debug(this.fragment.height);
        const gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');

        // Debugging
        document.body.appendChild(this.canvas);

        // Compile and initialise shaders and program from source GLSL files
        const vertexShader = createShader(gl, gl.VERTEX_SHADER, this.vertexShaderSource);
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, this.fragmentShaderSource);
        const program = createProgram(gl, vertexShader, fragmentShader);

        // Clear the canvas
        // TODO clear more cleverly
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // This is only needed if we actually view the ping-pong buffer,
        //  ie only if debugging.
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        gl.useProgram(program);

        setupPositionBuffer(gl, program);
        setUniform(gl, program, "fragmentSize", FRAGMENT_SIZE);
        setUniform(gl, program, "fragmentsX", this.canvas.width / FRAGMENT_SIZE);
        setUniform(gl, program, "fragmentsY", this.canvas.height);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}

function createShader(gl, type, source) {
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

function createProgram(gl, vertexShader, fragmentShader) {
    // https://webglfundamentals.org/webgl/lessons/webgl-fundamentals.html
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

function setUniform(gl, program, name, value) {
    let loc = gl.getUniformLocation(program, name);
    gl.uniform1i(loc, value);
}

function setupPositionBuffer(gl, program) {

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
