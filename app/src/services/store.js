/* https://vuejs.org/v2/guide/state-management.html#Simple-State-Management-from-Scratch */
// Vuex is overkill for out needs. Use a very simple global object store for
//  very basic state management.
import { get, set } from 'idb-keyval';
import eventBus from "@/eventBus.js";

// TODO load from local storage or similar
const USER_SETTING_DEFAULTS = {
    advancedMode: false,
    preferFileUpload: false,
    showAbcText: false,
    microphoneChoice: null
}

class Store {
    constructor() {
        this.state = {
            lastResults: [],
            lastNotes: "",
            backendVersion: "not loaded",
        };

        this.searchStates = {
            READY: "ready",
            RECORDING: "recording",
            WORKING: "working"
        };

        this.userSettings = USER_SETTING_DEFAULTS;
        this.settingsLoaded = get('userSettings').then(userSettings => {
            this.userSettings = userSettings || USER_SETTING_DEFAULTS;
        });

        this.searchState = this.searchStates.READY;
    }

    async getLocalTuneIndex() {
        return await get('tuneIndex');
    }

    async storeDownloadedTuneIndex(downloadedTuneIndex) {
        return await set('tuneIndex', downloadedTuneIndex);
    }

    async getLocalTuneIndexMetadata() {
        return await get('tuneIndexMetadata');
    }

    async storeDownloadedTuneIndexMetadata(downloadedTuneIndexMetadata) {
        return await set('tuneIndexMetadata', downloadedTuneIndexMetadata);
    }

    async updateUserSettings(userSettings) {
        // Usable immediately and synchronously by the entire application.
        this.userSettings = userSettings;

        // Save for later so that when we reload the settings page / restart 
        //  app, the settings are maintained.
        set('userSettings', userSettings);
    }

    isReady() {
        return this.searchState === this.searchStates.READY;
    }

    isRecording() {
        return this.searchState === this.searchStates.RECORDING;
    }

    isWorking() {
        return this.searchState === this.searchStates.WORKING;
    }

    setSearchState(state) {
        this.searchState = state;
        if (!(this.isReady() || this.isRecording() || this.isWorking())) {
            this.searchState = this.searchStates.READY;
            console.error(`Invalid state ${state}`);
        }
        eventBus.$emit("setSearchState");
    }
};

const store = new Store();
export default store;