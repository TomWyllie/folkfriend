/* https://vuejs.org/v2/guide/state-management.html#Simple-State-Management-from-Scratch */
// Vuex is overkill for out needs. Use a very simple global object store for
//  very basic state management.


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

        // TODO load from local storage or similar
        this.userSettings = USER_SETTING_DEFAULTS;

        this.searchState = this.searchStates.READY;
    }
    
    setEntry(key, val) {
        // console.debug(`setEntry triggered with [${key}]`, val);
        this.state[key] = val;
    }
    
    clearEntry(key) {
        // console.debug(`clearEntry triggered [${key}]`);
        this.state[key] = null;
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
            throw "Invalid state";
        }
    }
};

const store = new Store();
export default store;