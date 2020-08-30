const DSPModule = Module;
let dspInitialised = false;
DSPModule.onRuntimeInitialized = _ => {
    dspInitialised = true;
}

class AudioDSP {
    constructor() {
        this.freqDataPtr = null;
        this.freqDataArr = null;
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
                // We might've missed the boat.
                wrapAndReady();
            } else {
                DSPModule.onRuntimeInitialized = wrapAndReady();
            }
        });
    }


    malloc() {
        // Note that the WASM expects the output from analyserNode.getFloatFrequencyData();
        //  BUT we're not done with DSP, because as part of the processing we have to scale
        //  the values and take the FFT again, along with some other filtering steps.

        //  Useful info:
        // https://github.com/WebAssembly/design/issues/1231

        // Get data byte size, allocate memory on Emscripten heap, and get pointer
        // let freqDataBytes = freqData.length * freqData.BYTES_PER_ELEMENT;
        this.freqDataPtr = this.api.malloc(512);

        // Copy data to heap
        this.freqDataArr = new Float32Array(Module.HEAPU8.buffer, this.freqDataPtr, 512);

    }

    processFreqData(freqData) {
        if(this.freqDataArr === null) {
            this.malloc();
        }

        this.freqDataArr.set(freqData);

        // console.debug("freqData in", freqData);

        // Process
        this.api.processFrame(this.freqDataPtr);

        // Copy data out of heap
        freqData.set(this.freqDataArr)

        // console.debug("freqData out", freqData);

        // Free memory (?)
        // this.api.free(this.freqDataArr.byteOffset);

        // Garbage collection is not automatic
        //  (but delete() isn't a function here)
        // freqDataArr.delete();

        return freqData.slice(0, FFConfig.SPEC_NUM_BINS);
    }
}
