// If in a module, otherwise include js file globally with <script>
import loadDSPWasmModule from './ff-wasm.js';
import FFConfig from './ff-config.js';

let DSPModule;

class DSP {
    constructor() {
        this.api = null;
        this.timeDomainDataPtr = null;
        this.timeDomainDataArr = null;
        this.resamplingArrs = null;
        this.sampleRate = null;

        this.ready = new Promise((resolve) => {
            this.setReady = resolve;
        });
    }

    async initialise() {
        DSPModule = await loadDSPWasmModule();
        // eslint-disable-next-line no-undef
        this.api = {
            processFrame: DSPModule.cwrap(
                "processFreqData", null, ["number"]),
            updateResamplingCoefficients: DSPModule.cwrap(
                "updateResamplingCoefficients", null, ["number", "number", "number", "number"]),
            malloc: DSPModule.cwrap(
                "mallocWrapper", "number", ["number"]),
            free: DSPModule.cwrap(
                "freeWrapper", null, ["number"]),
        };

        // This is the default.
        await this.setSampleRate(FFConfig.SAMPLE_RATE, true);

        this.setReady();
    }

    malloc(length, arrayType = Float32Array) {
        // Note that the WASM expects the output from analyserNode.getFloatFrequencyData();
        //  BUT we're not done with DSP, because as part of the processing we have to scale
        //  the values and take the FFT again, along with some other filtering steps.

        let heap;
        switch (arrayType) {
            // Add in the other heaps here if we need them.
            case Uint16Array:
                heap = DSPModule.HEAPU16;
                break;
            case Int32Array:
                heap = DSPModule.HEAP32;
                break;
            case Float32Array:
                heap = DSPModule.HEAPF32;
                break;
        }

        //  Useful info:
        // https://github.com/WebAssembly/design/issues/1231

        // Get data byte size, allocate memory on Emscripten heap, and get pointer
        // let freqDataBytes = freqData.length * freqData.BYTES_PER_ELEMENT;
        const bytesToAllocate = length * arrayType.BYTES_PER_ELEMENT;
        const ptr = this.api.malloc(bytesToAllocate);

        // Create view of data in heap
        const arr = new arrayType(heap.buffer, ptr, length);

        return {ptr, arr};
    }

    processTimeDomainData(timeDomainData) {
        if (this.api === null) {
            throw `DSP Not yet initialised`;
        }

        if (this.timeDomainDataArr === null) {
            const {ptr, arr} = this.malloc(FFConfig.SPEC_WINDOW_SIZE);
            this.timeDomainDataPtr = ptr;
            this.timeDomainDataArr = arr;
        }

        this.timeDomainDataArr.set(timeDomainData);

        // Process
        this.api.processFrame(this.timeDomainDataPtr);

        // Copy data out of heap. Even though the data we put in is
        //  SPEC_WINDOW_SIZE / 2 long we only retrieve a much smaller number
        //  (eg 144 vs 512) of entries from this array. The WASM code knows
        //  to only bother writing to this subset of the array.
        timeDomainData.set(this.timeDomainDataArr);

        return timeDomainData.slice(0, FFConfig.SPEC_NUM_BINS);
    }

    async setSampleRate(sampleRate, initial=false) {
        if (this.sampleRate === sampleRate) {
            return;
        }

        if(!initial) {
            await this.ready;
        }

        // Generate the Float32Arrays that store the relevant data for WASM
        //  (to be honest these could easily be stored in WebAssembly I'm just
        //      more confident in javascript than C++)
        const {
            loIndices, hiIndices, loWeights, hiWeights
        } = generateResampleCoefficients(sampleRate);

        if (this.resamplingArrs === null) {
            this.resamplingArrs = {};

            let {ptr: loIptr, arr: loIarr} = this.malloc(loIndices.length, Int32Array);
            let {ptr: hiIptr, arr: hiIarr} = this.malloc(hiIndices.length, Int32Array);
            let {ptr: loWptr, arr: loWarr} = this.malloc(loWeights.length, Float32Array);
            let {ptr: hiWptr, arr: hiWarr} = this.malloc(hiWeights.length, Float32Array);

            // Tell WebAssembly to use these arrays we just allocated on the heap
            this.api.updateResamplingCoefficients(loIptr, hiIptr, loWptr, hiWptr);

            this.resamplingArrs = {
                loIndices: loIarr,
                hiIndices: hiIarr,
                loWeights: loWarr,
                hiWeights: hiWarr
            };
        }

        console.debug('Updating resampling coefficients');
        this.resamplingArrs.loIndices.set(loIndices);
        this.resamplingArrs.hiIndices.set(hiIndices);
        this.resamplingArrs.loWeights.set(loWeights);
        this.resamplingArrs.hiWeights.set(hiWeights);
    }
}

function generateResampleCoefficients(sampleRate) {
    // Let LMB = linearMidiBins.length
    //
    // [<--frame.length-->] [<-      LMB       ->]   /\
    //                      |                    |
    //                      |                    |  frame.length
    //                      |                    |
    //                      [                    ]   \/
    //
    // Frame: 1x512            Interp: 512xLMB
    //
    // Result: 1xLMB
    //
    // We don't actually do this as a matrix multiplication but do it
    //   sparsely for efficiency.

    // These will be the midi values of the bins that make up each frame that
    //  is fed into the CNN.
    const linearMidiBins = new Float32Array(FFConfig.SPEC_NUM_BINS);
    const binWidth = 1 / FFConfig.SPEC_BINS_PER_MIDI;
    const binOffset = Math.floor(FFConfig.SPEC_BINS_PER_MIDI / 2);
    for (let i = 0; i < FFConfig.SPEC_NUM_BINS; i++) {
        // These are LINEARLY spaced.
        linearMidiBins[i] = FFConfig.MIDI_LOW + (i - binOffset) * binWidth;
    }

    // console.debug('Desired linear bins:', linearMidiBins);

    // Our frame will be half spectrogram window size at this stage
    const actualBinIndices = [...Array(FFConfig.SPEC_WINDOW_SIZE / 2).keys()];
    const actualBinMidis = new Float32Array(actualBinIndices.length);

    // Zero frequency is never used but DC component = midi note[-infinity]
    //   which breaks following functions. Set it to the second lowest midi
    //   note (-20 or something around that value) as neither are used.
    actualBinIndices[0] = 1;

    // Now we convert the actual bin indices to their actual midi note values.
    //  As we have done two FFTs this conversion is equivalent to converting
    //  autocorrelation indices to frequency. THIS DEPENDS ON SAMPLE RATE!
    //  (and so by doing this step we are allowing user sample rates to
    //      and dealing with the consequences ourselves, here)
    for (let i = 0; i < actualBinMidis.length; i++) {
        actualBinMidis[i] = binToMidi(actualBinIndices[i], sampleRate);
    }

    // console.debug('Original bins:', actualBinMidis);

    const lmb = linearMidiBins.length;
    const loIndices = new Uint16Array(lmb);
    const hiIndices = new Uint16Array(lmb);
    const loWeights = new Float32Array(lmb);
    const hiWeights = new Float32Array(lmb);

    for (const [i, targetBinMidi] of linearMidiBins.entries()) {
        // Each linear midi bin is a linear combination of two bins from
        //  the spectrogram

        if (targetBinMidi < actualBinMidis[actualBinMidis.length - 2]) {
            throw "Linear bin goes too low";
        }

        // Note both arrays are monotonically decreasing in value
        let lo = 0;
        for (let j = 0; j < actualBinMidis.length; j++) {
            if (targetBinMidi > actualBinMidis[j]) {
                lo = j;
                break;
            }
        }

        const delta = actualBinMidis[lo - 1] - actualBinMidis[lo];
        const x1 = (actualBinMidis[lo - 1] - targetBinMidi) / delta;
        const x2 = -(actualBinMidis[lo] - targetBinMidi) / delta;

        if (x1 > 1 || x1 < 0 || x2 > 1 || x2 < 0) {
            throw `Invalid x1: ${x1}, x2: ${x2}`;
        }

        // Frequencies are decreasing so lower index => higher freq
        loIndices[i] = lo;
        hiIndices[i] = lo - 1;
        loWeights[i] = x1;
        hiWeights[i] = x2;
    }

    // But in the implementation of doing this we have flipped the direction
    //  of the arrays (low indices = high pitches) and we really want it
    //  to be the other way around, so flip all the generated arrays.
    loIndices.reverse();
    hiIndices.reverse();
    loWeights.reverse();
    hiWeights.reverse();

    return {loIndices, hiIndices, loWeights, hiWeights};
}


function binToMidi(autocorrIndex, sampleRate) {
    // Convert frequency bins into MIDI notes, according to equation
    // {midi notes relative to A4} = log_base[2^1/12](frequency / 440Hz)
    //  and                   freq = sampleRate / index
    // Which simplifies to midi note values of autocorrelation index =
    //  69 + log_base[2^1/12](index / 440)
    const arr = sampleRate / (440.0 * autocorrIndex);
    const base = 2 ** (1. / 12.);
    return 69 + Math.log(arr) / Math.log(base);
}

const dsp = new DSP();
export default dsp;