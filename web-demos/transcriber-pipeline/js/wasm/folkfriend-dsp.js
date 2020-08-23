DSPModule = Module;
let dspInitialised = false;
DSPModule.onRuntimeInitialized = _ => {
    dspInitialised = true;
}

class AudioDSP {
    constructor() {
        this.ready = new Promise(resolve => {
            let wrapAndReady = _ => {
                this.api = {
                    processFrame: DSPModule.cwrap(
                        "processFreqData", null, ["number"]),
                    malloc: DSPModule.cwrap(
                        "mallocWrapper", "number", ["number"]),
                    free: DSPModule.cwrap(
                        "freeWrapper", "number", ["number"]),
                }
                resolve();
            }
            if(dspInitialised) {
                wrapAndReady();
            } else {
                DSPModule.onRuntimeInitialized = wrapAndReady();
            }
        });
    }
    
    processFreqData(freqData) {
        // Note that the WASM expects the output from analyserNode.getFloatFrequencyData();
        //  BUT we're not done with DSP, because as part of the processing we have to scale
        //  the values and take the FFT again, along with some other filtering steps.

        //  Useful info:
        // https://github.com/WebAssembly/design/issues/1231

        // Get data byte size, allocate memory on Emscripten heap, and get pointer
        // let freqDataBytes = freqData.length * freqData.BYTES_PER_ELEMENT;
        let freqDataPtr = this.api.malloc(freqData.length);

        // Copy data to heap
        let freqDataArr = new Float32Array(Module.HEAPU8.buffer, freqDataPtr, freqData.length);
        freqDataArr.set(freqData);

        // console.debug("freqData in", freqData);

        // Process
        this.api.processFrame(freqDataPtr);

        // Copy data out of heap
        freqData.set(freqDataArr)

        // console.debug("freqData out", freqData);

        // Free memory
        this.api.free(freqDataArr.byteOffset);

        return freqData.slice(20, 320);
    }
}
