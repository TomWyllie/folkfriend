import * as Comlink from "@/services/comlink.js";
import store from "@/services/store.js";
import router from "@/router/index.js";

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

    async runTranscriptionQuery(query) {
        return new Promise(resolve => {
            this.folkfriendWASMWrapper.runTranscriptionQuery(query, Comlink.proxy(response => {
                resolve(response);
            }));
        })
    }

    async submitFilledBuffer() {
        console.debug("Submitting filled buffer");

        const contour = await this.transcribePCMBuffer();
        console.debug("contour", contour);

        // If we have limited the recording time, then the query will probably
        //  be short, and so it's sensible to run a search query. Users can
        //  disable the automatic querying if they desire, for example if
        //  transcribing a new and/or long tune to sheet music.
        const doQuery = store.state.recordingTimeLimited;

        if (doQuery) {
            const queryResults = await this.runTranscriptionQuery(contour);
            store.setEntry("lastResults", queryResults);
            router.push({ name: "results" });
            console.debug(queryResults);
        }

        const notes = await this.contourToAbc(contour);
        store.setEntry("lastNotes", notes);

        if (!doQuery) {
            console.debug(notes);
        }

        store.setSearchState(store.searchStates.READY);
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

    async settingsFromTuneID(tuneID) {
        return new Promise(resolve => {
            this.folkfriendWASMWrapper.settingsFromTuneID(tuneID, Comlink.proxy(response => {
                resolve(response);
            }));
        })
    }

    async aliasesFromTuneID(tuneID) {
        return new Promise(resolve => {
            this.folkfriendWASMWrapper.aliasesFromTuneID(tuneID, Comlink.proxy(response => {
                resolve(response);
            }));
        })
    }
}

const ffBackend = new FFBackend();
export default ffBackend;