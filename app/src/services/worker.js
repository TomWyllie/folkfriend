import * as Comlink from "./comlink";
import ffConfig from "@/ffConfig";
import { get, set } from 'idb-keyval';


// async getLocalTuneIndex() {
//     return await get('tuneIndex');
// }

// async storeDownloadedTuneIndex(downloadedTuneIndex) {
//     return await set('tuneIndex', downloadedTuneIndex);
// }

// async getLocalTuneIndexMetadata() {
//     return await get('tuneIndexMetadata');
// }

// async storeDownloadedTuneIndexMetadata(downloadedTuneIndexMetadata) {
//     return await set('tuneIndexMetadata', downloadedTuneIndexMetadata);
// }

class FolkFriendWASMWrapper {
    constructor() {
        this.folkfriendWASM = null;
        this.abcStringBySetting = {};

        this.loadedWASM = new Promise(resolve => {
            this.setLoadedWASM = resolve;
        });
        this.loadedIndex = new Promise(resolve => {
            this.setLoadedIndex = resolve;
        });
        this.loadedSampleRate = new Promise(resolve => {
            this.setLoadedSampleRate = resolve;
        });

        import("@/wasm/folkfriend.js").then(wasm => {
            this.folkfriendWASM = new wasm.FolkFriendWASM();
            this.setLoadedWASM();
        });
    }

    async version(cb) {
        await this.loadedWASM;
        cb(this.folkfriendWASM.version());
    }

    async onIndexLoad(cb) {
        await this.loadedWASM;
        await this.loadedIndex;
        cb();
    }

    async fetchTuneIndexMetadata() {
        let url = "/res/nud-meta.json";
        if (process.env.NODE_ENV === 'production') {
            url = "https://folkfriend-app-data.web.app/nud-meta.json";
        }
        let indexData = await fetch(url)
            .then((response) => response.json())
            .catch((err) => console.log(err));
        return indexData;
    }

    async fetchTuneIndexData() {
        console.time("index-fetch");

        let url = "/res/folkfriend-non-user-data.json";
        if (process.env.NODE_ENV === 'production') {
            url = "https://folkfriend-app-data.web.app/folkfriend-non-user-data.json";
        }

        // Fetch
        let indexData = await fetch(url)
            .then((response) => response.json())
            .catch((err) => console.log(err));

        // Lightly postprocess. ABC strings don't go to WASM because
        //  of slow memory loading in WebAssembly.        
        let abcStringBySetting = {};
        for (let settingID in indexData.settings) {
            abcStringBySetting[settingID] = indexData.settings[settingID].abc;
            indexData.settings[settingID].abc = "";
        }

        const downloadedTuneIndex = {
            indexData: indexData,
            abcStrings: abcStringBySetting
        }

        console.timeEnd("index-fetch");

        return downloadedTuneIndex;
    }

    async setupTuneIndex() {
        // This is the entry point, run every application start, for
        //  loading in the tune index ASAP and also maintaining an up-to-date
        //  offline copy.
        console.time("tune-index-setup");
        console.time("tune-index-load");

        // This will be null if no tune index has been stored.
        const localTuneIndex = await get("tuneIndex");

        if (typeof localTuneIndex === "undefined") {
            console.debug("No tune index was cached, requesting download");

            const downloadedTuneIndex = await this.fetchTuneIndexData();

            // Load (so the user can start using the application)
            await this.loadTuneIndex(downloadedTuneIndex);
            console.timeEnd("tune-index-load");

            // Store the version of this newly downloaded tune index
            const tuneIndexMetadata = await this.fetchTuneIndexMetadata();            
            await set("tuneIndex", downloadedTuneIndex);
            await set("tuneIndexMetadata", tuneIndexMetadata);

        } else {
            console.debug("Found cached tune index");

            // Load cached copy
            await this.loadTuneIndex(localTuneIndex);
            console.timeEnd("tune-index-load");

            // THEN check the latest version and if we want to upgrade
            const tuneIndexMetadataRemote = await this.fetchTuneIndexMetadata();
            let tuneIndexMetadataLocal = await get("tuneIndexMetadata");

            if (typeof tuneIndexMetadataLocal === 'undefined') {
                // This is a near-impossible state, only reached by people 
                //  selectively deleting from IndexedDB. As browsers do delete
                //   from IndexedDB when under storage pressure it's best to
                //   cover this case and be safe.
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
                const downloadedTuneIndex = await this.fetchTuneIndexData();
                await set("tuneIndex", downloadedTuneIndex);
                await set("tuneIndexMetadata", tuneIndexMetadataRemote);
            }
        }
        console.timeEnd("tune-index-setup");
    }

    async loadTuneIndex(tuneIndex) {
        console.time("tune-index-to-wasm");
        await this.loadedWASM;
        await this.folkfriendWASM.load_index_from_json_obj(tuneIndex.indexData);
        this.abcStringBySetting = tuneIndex.abcStrings;
        this.setLoadedIndex();
        console.timeEnd("tune-index-to-wasm");
    }

    async setSampleRate(sampleRate) {
        await this.loadedWASM;
        await this.folkfriendWASM.set_sample_rate(sampleRate);
        this.setLoadedSampleRate();
    }

    async feedEntirePCMSignal(PCMSignal) {
        const frames = Math.floor(PCMSignal.length / ffConfig.SPEC_WINDOW_SIZE);
        if (frames === 0) {
            throw 'PCM signal too short';
        }
        for (let i = 0; i < frames; i++) {
            const PCMWindow = PCMSignal.slice(
                ffConfig.SPEC_WINDOW_SIZE * i,
                ffConfig.SPEC_WINDOW_SIZE * (i + 1)
            );
            await this.feedSinglePCMWindow(PCMWindow);
        }
    }

    async feedSinglePCMWindow(PCMWindow) {
        await this.loadedWASM;
        await this.loadedSampleRate;
        const ptr = await this.folkfriendWASM.alloc_single_pcm_window();
        const arr = await this.folkfriendWASM.get_allocated_pcm_window(ptr);

        arr.set(PCMWindow);

        await this.folkfriendWASM.feed_single_pcm_window(ptr);
        // console.debug("feedSinglePCMWindow: complete");
    }

    async flushPCMBuffer() {
        await this.folkfriendWASM.flush_pcm_buffer();
    }

    async transcribePCMBuffer(cb) {
        const contour = await this.folkfriendWASM.transcribe_pcm_buffer();
        cb(contour);
    }

    async runTranscriptionQuery(query, cb) {
        await this.loadedWASM;
        await this.loadedIndex;
        const response = await this.folkfriendWASM.run_transcription_query(query);
        cb(JSON.parse(response));
    }

    async runNameQuery(query, cb) {
        await this.loadedWASM;
        await this.loadedIndex;
        const response = await this.folkfriendWASM.run_name_query(query);
        cb(JSON.parse(response));
    }

    async contourToAbc(contour, cb) {
        await this.loadedWASM;
        const abc = await this.folkfriendWASM.contour_to_abc(contour);
        cb(abc);
    }

    async settingsFromTuneID(tuneID, cb) {
        await this.loadedWASM;
        await this.loadedIndex;

        const response = await this.folkfriendWASM.settings_from_tune_id(tuneID);
        let settings = JSON.parse(response);

        // Recall that we delete the ABC string before passing data into WebAssembly,
        //  because otherwise it takes a lot of time every startup to load that data in
        //  and it's only used by the frontend and not the backend. So here we reinject
        //  the ABC strings that are stored in the worker.
        let settingsIncludingAbc = settings.map(([settingID, setting]) => {
            setting['setting_id'] = settingID;
            setting['abc'] = this.abcStringBySetting[settingID];
            return setting;
        })

        cb(settingsIncludingAbc);
    }

    async aliasesFromTuneID(tuneID, cb) {
        await this.loadedWASM;
        await this.loadedIndex;
        const aliases = await this.folkfriendWASM.aliases_from_tune_id(tuneID);
        cb(JSON.parse(aliases));
    }
}

const folkfriendWASMWrapper = new FolkFriendWASMWrapper();
Comlink.expose(folkfriendWASMWrapper);
