import * as Comlink from "./comlink";
import ffConfig from "@/ffConfig";

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

    async firstTimeIndexSetup(cb) {
        // Download
        const downloadedTuneIndex = await this.fetchTuneIndexData();
        
        // Load (so the user can start using the application)
        console.time('index-parse-from-worker');
        await this.loadTuneIndex(downloadedTuneIndex);
        console.timeEnd('index-parse-from-worker');
        
        // Pass the object back to the main thread for caching
        cb(downloadedTuneIndex);
    }
    
    async loadTuneIndex(tuneIndex) {
        await this.loadedWASM;
        await this.folkfriendWASM.load_index_from_json_obj(tuneIndex.indexData);
        this.abcStringBySetting = tuneIndex.abcStrings;
        this.setLoadedIndex();
    }

    async setSampleRate(sampleRate) {
        await this.folkfriendWASM.set_sample_rate(sampleRate);
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
        const ptr = await this.folkfriendWASM.alloc_single_pcm_window();
        const arr = await this.folkfriendWASM.get_allocated_pcm_window(ptr);

        arr.set(PCMWindow);

        await this.folkfriendWASM.feed_single_pcm_window(ptr);
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
