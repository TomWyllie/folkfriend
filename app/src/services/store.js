/* https://vuejs.org/v2/guide/state-management.html#Simple-State-Management-from-Scratch */
// Vuex is overkill for out needs. Use a very simple global object store for
//  very basic state management.
import eventBus from '@/eventBus.js';
import {get,
    set
} from 'idb-keyval';
import {
    logEvent
} from 'firebase/analytics';

// TODO load from local storage or similar
const USER_SETTING_DEFAULTS = {
    advancedMode: false,
    preferFileUpload: false,
    showAbcText: false,
    microphoneChoice: null
};

class Store {
    constructor() {
        this.state = {
            indexLoaded: false,
            lastResults: [],
            lastContour: '',
            lastTimer: null,
            backendVersion: 'not loaded'
        };

        this.searchStates = {
            READY: 'ready',
            RECORDING: 'recording',
            WORKING: 'working'
        };

        this.userSettings = JSON.parse(localStorage.getItem('userSettings')) || USER_SETTING_DEFAULTS;
        this.searchState = this.searchStates.READY;

        this.analytics = null;
        this.analyticsLoaded = new Promise(resolve => {
            this.setAnalyticsLoaded = resolve;
        });
    }

    async updateUserSettings(userSettings) {
        // Usable immediately and synchronously by the entire application.
        this.userSettings = userSettings;

        // Save for later so that when we reload the settings page / restart
        //  app, the settings are maintained.
        localStorage.setItem('userSettings', JSON.stringify(userSettings));
    }

    async getHistoryItems() {
        return await get('historyItems') || [];
    }

    async addToHistory(tuneHistoryItem) {
        let historyItems = await get('historyItems') || [];

        if (tuneHistoryItem.result.setting && tuneHistoryItem.result.setting.tune_id) {
            let newTuneID = tuneHistoryItem.result.setting.tune_id;
            for (let [i, oldHistoryItem] of historyItems.entries()) {
                if (oldHistoryItem.result.setting && oldHistoryItem.result.setting.tune_id === newTuneID) {
                    historyItems.splice(i, 1);
                    break;
                }
            }
        }

        historyItems.unshift(tuneHistoryItem);
        historyItems = historyItems.slice(0, 100);

        await set('historyItems', historyItems);
    }

    loadAnalytics(analytics) {
        this.analytics = analytics;
        this.setAnalyticsLoaded();
    }

    async logAnalyticsEvent(eventLabel, eventData) {
        await this.analyticsLoaded;
        if (process.env.NODE_ENV === 'production') {
            console.debug('EVENT LOGGED', eventLabel);
            logEvent(this.analytics, eventLabel, eventData);
        }
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
        eventBus.$emit('setSearchState');
    }
}

const store = new Store();
export default store;