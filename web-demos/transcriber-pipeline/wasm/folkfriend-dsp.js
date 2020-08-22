DSPModule = Module;

function main() {
    demo().catch(console.error);
}

async function demo() {
    const audioDSP = new AudioDSP();
    await audioDSP.ready;

    const freqData = new Float32Array(512);
    freqData.fill(0);
    freqData[1] = 2.0;
    freqData[3] = 1.0;
    audioDSP.processFreqData(freqData);
}

class AudioDSP {
    constructor() {
        this.ready = new Promise(resolve => {
            DSPModule.onRuntimeInitialized = _ => {
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
        });
    }
    
    processFreqData(freqData) {
        // Note that the WASM expects the output from analyserNode.getFloatFrequencyData();
        //  BUT we're not done with DSP, because as part of the processing we have to scale
        //  the values and take the FFT again, along with some other filtering steps.

        console.time("processFreqData");

        // Get data byte size, allocate memory on Emscripten heap, and get pointer
        let freqDataBytes = freqData.length * freqData.BYTES_PER_ELEMENT;
        let freqDataPtr = this.api.malloc(freqDataBytes);

        // Copy data to heap
        let dataHeap = new Uint8Array(Module.HEAPU8.buffer, freqDataPtr, freqDataBytes);
        dataHeap.set(new Uint8Array(freqData.buffer));

        // Process
        this.api.processFrame(dataHeap.byteOffset);

        // Copy data out of heap
        let result = new Float32Array(dataHeap.buffer, dataHeap.byteOffset, freqData.length);

        // Free memory
        this.api.free(dataHeap.byteOffset);

        console.timeEnd("processFreqData");
        console.log(result);
    }
}

window.onload = main;
