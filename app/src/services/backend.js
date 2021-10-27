import * as Comlink from "@/services/comlink.js";
import store from "@/services/store.js";
import router from "@/router/index.js";
import eventBus from "@/eventBus";

class FFBackend {
    /* Yet another layer of abstraction. This class is the route that all 
        information to / from the WebAssembly backend must pass through.
        This is the class that the app directly uses to make use of folkfriend.
        It uses comlink and callbacks to communicate with the worker thread,
        which actually loads in the WebAssembly module.
    */

    constructor() {
        const worker = new Worker("./worker.js", { type: "module" });
        this.folkfriendWorker = Comlink.wrap(worker);

        this.folkfriendWorker.onIndexLoad(Comlink.proxy(() => {
            eventBus.$emit("indexLoaded");
        }));
    }

    async version() {
        return new Promise(resolve => {
            this.folkfriendWorker.version(Comlink.proxy(version => {
                resolve(version);
            }))
        });
    }

    async fetchTuneIndexMetadata() {
        console.time("index-fetch-meta");

        let url = "/res/nud-meta.json";
        if (process.env.NODE_ENV === 'production') {
            url = "https://folkfriend-app-data.web.app/nud-meta.json";
        }

        let indexData = await fetch(url)
            .then((response) => response.json())
            .catch((err) => console.log(err));
        console.timeEnd("index-fetch-meta");
        return indexData;
    }

    async setupTuneIndex() {
        // This is the entry point, run every application start, for
        //  loading in the tune index ASAP and also maintaining an up-to-date
        //  offline copy.
        console.time("load-tune-index");

        // This will be null if no tune index has been stored.
        const localTuneIndex = await store.getLocalTuneIndex();

        // Web workers can't access localStorage. So if we're using cached
        //  offline data then we load it here and pass it to the worker.
        //  If there's no index cached, then we can download AND load it
        //  directly in the worker, without needlessly passing the object to 
        //  the main thread and back again on the first time the app starts
        //  (which saves some time).
        if (typeof localTuneIndex === 'undefined') {
            console.debug("No tune index was cached, requesting worker downloads");
            await this.folkfriendWorker.firstTimeIndexSetup(Comlink.proxy(downloadedTuneIndex => {
                // Store result into localStorage
                store.storeDownloadedTuneIndex(downloadedTuneIndex);
            }));
            console.timeEnd("load-tune-index");

            // Track the version of this tune index
            const tuneIndexMetadata = await this.fetchTuneIndexMetadata();
            await store.storeDownloadedTuneIndexMetadata(tuneIndexMetadata);
        } else {
            console.debug("Found cached tune index, loading into worker");

            // Pass loaded result into worker
            await this.folkfriendWorker.loadTuneIndex(localTuneIndex);
            console.timeEnd("load-tune-index");

            // THEN check new version and if we want to upgrade
            const tuneIndexMetadataRemote = await this.fetchTuneIndexMetadata();
            let tuneIndexMetadataLocal = await store.getLocalTuneIndexMetadata();

            if (typeof tuneIndexMetadataLocal === 'undefined') {
                // This should be an near-impossible state, only reached by
                //  people selectively deleting from IndexedDB. As browsers
                //  do delete from IndexedDB when under storage pressure it's
                //  best to cover this case and be safe.
                tuneIndexMetadataLocal = { 'v': 0 };
            }

            const remoteVersion = tuneIndexMetadataRemote['v'];
            const localVersion = tuneIndexMetadataLocal['v'];
            const daysSinceUpdate = remoteVersion - localVersion;
            console.debug(`Tune index was ${daysSinceUpdate} days out of date`)

            // Folkfriend's TuneIndex (at time of writing) updates once a week,
            //  scheduled to update just after the latest data dump on Github
            //  from thesession.org. Having all users automatically update the 
            //  whole index every week is a little overkill though and uses a
            //  lot of bandwidth (which may not be free). Only auto-update if
            //  it's been a while since the last update. A while = 4 weeks.
            if (daysSinceUpdate >= 28) {
                console.debug("Upgrading tune index")

                await this.folkfriendWorker.firstTimeIndexSetup(Comlink.proxy(downloadedTuneIndex => {
                    // Store result into localStorage
                    store.storeDownloadedTuneIndex(downloadedTuneIndex);
                }));
                await store.storeDownloadedTuneIndexMetadata(tuneIndexMetadataRemote);
            }
        }
    }

    async loadIndex() {
        await this.folkfriendWorker.loadIndex(Comlink.proxy(duration => {
            // alert(duration);
        }));
    }

    async setSampleRate(sampleRate) {
        await this.folkfriendWorker.setSampleRate(sampleRate);
    }

    async feedEntirePCMSignal(PCMSignal) {
        await this.folkfriendWorker.feedEntirePCMSignal(PCMSignal);
    }

    async feedSinglePCMWindow(PCMWindow) {
        await this.folkfriendWorker.feedSinglePCMWindow(PCMWindow);
    }

    async flushPCMBuffer() {
        await this.folkfriendWorker.flushPCMBuffer();
    }

    async transcribePCMBuffer() {
        console.time("transcribe-pcm-buffer");
        return new Promise(resolve => {
            this.folkfriendWorker.transcribePCMBuffer(Comlink.proxy(contour => {
                console.timeEnd("transcribe-pcm-buffer");
                resolve(contour);
            }))
        });
    }

    async runTranscriptionQuery(query) {
        console.time("run-transcription-query");
        return new Promise(resolve => {
            this.folkfriendWorker.runTranscriptionQuery(query, Comlink.proxy(response => {
                console.timeEnd("run-transcription-query");
                resolve(response);
            }));
        })
    }

    async submitFilledBuffer() {
        const contour = await this.transcribePCMBuffer();
        console.debug("contour", contour);

        // If we have limited the recording time, then the query will probably
        //  be short, and so it's sensible to run a search query. Users can
        //  disable the automatic querying if they desire, for example if
        //  transcribing a new and/or long tune to sheet music.
        const doQuery = !store.userSettings.advancedMode;

        if (doQuery) {
            const queryResults = await this.runTranscriptionQuery(contour);
            store.state.lastResults = queryResults;
            router.push({ name: "results" });
            eventBus.$emit("childViewActivated");
        }

        const notes = await this.contourToAbc(contour);
        store.state.lastNotes = notes;

        if (!doQuery) {
            router.push({ name: "score" });
            eventBus.$emit("childViewActivated");
        }

        store.setSearchState(store.searchStates.READY);
    }

    async runNameQuery(query) {
        return new Promise(resolve => {
            this.folkfriendWorker.runNameQuery(query, Comlink.proxy(response => {
                resolve(response);
            }));
        })
    }

    async contourToAbc(contour) {
        return new Promise(resolve => {
            this.folkfriendWorker.contourToAbc(contour, Comlink.proxy(abc => {
                resolve(abc);
            }));
        })
    }

    async settingsFromTuneID(tuneID) {
        return new Promise(resolve => {
            this.folkfriendWorker.settingsFromTuneID(tuneID, Comlink.proxy(response => {
                resolve(response);
            }));
        })
    }

    async aliasesFromTuneID(tuneID) {
        return new Promise(resolve => {
            this.folkfriendWorker.aliasesFromTuneID(tuneID, Comlink.proxy(response => {
                resolve(response);
            }));
        })
    }
}

const ffBackend = new FFBackend();
export default ffBackend;