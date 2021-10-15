import * as Comlink from "./comlink";

class FFBackend {
    /* Yet another layer of abstraction. This class is the route that all 
        information to / from the WebAssembly backend must pass through.
        This is the class that the app directly uses to make use of folkfriend.
        It uses comlink and callbacks to communicate with the worker thread,
        which actually loads in the WebAssembly module.
    */

    constructor() {
        const worker = new Worker("./worker.js", { type: "module" });
        this.folkfriendWASMWrapper = Comlink.wrap(worker);
    }

    async version() {
        return new Promise(resolve => {
            this.folkfriendWASMWrapper.version(Comlink.proxy(version => {
                resolve(version);
            }))
        });
    }

    async loadIndex() {
        await this.folkfriendWASMWrapper.loadIndex(Comlink.proxy(duration => {
            // alert(duration);
        }));
    }

    async setSampleRate(sampleRate) {
        await this.folkfriendWASMWrapper.setSampleRate(sampleRate);
    }

    async feedEntirePCMSignal(PCMSignal) {
        await this.folkfriendWASMWrapper.feedEntirePCMSignal(PCMSignal);
    }

    async feedSinglePCMWindow(PCMWindow) {
        await this.folkfriendWASMWrapper.feedSinglePCMWindow(PCMWindow);
    }

    async flushPCMBuffer() {
        await this.folkfriendWASMWrapper.flushPCMBuffer();
    }

    async transcribePCMBuffer() {
        return new Promise(resolve => {
            this.folkfriendWASMWrapper.transcribePCMBuffer(Comlink.proxy(contour => {
                resolve(contour);
            }))
        });
    }

    // pub fn transcribe_pcm_buffer(&mut self) -> decode::types::ContourString {
    //     let contour = self
    //         .feature_decoder
    //         .decode(&mut self.feature_extractor.features);
    //     self.feature_extractor.flush();
    //     return contour;
    // }

    async runTranscriptionQuery(query) {
        return new Promise(resolve => {
            this.folkfriendWASMWrapper.runTranscriptionQuery(query, Comlink.proxy(response => {
                resolve(response);
            }));
        })
    }

    async runNameQuery(query) {
        return new Promise(resolve => {
            this.folkfriendWASMWrapper.runNameQuery(query, Comlink.proxy(response => {
                resolve(response);
            }));
        })
    }

    async contourToAbc(contour) {
        return new Promise(resolve => {
            this.folkfriendWASMWrapper.contourToAbc(contour, Comlink.proxy(abc => {
                resolve(abc);
            }));
        })
    }

}

const ffBackend = new FFBackend();
export default ffBackend;