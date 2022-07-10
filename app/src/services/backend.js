import * as Comlink from '@/js/comlink.js';
import store from '@/services/store.js';
import router from '@/router/index.js';
import eventBus from '@/eventBus';
import ffConfig from '@/ffConfig.js';
import {
    HistoryItem
} from '@/js/schema';

class FFBackend {
    /* Yet another layer of abstraction. This class is the route that all
            information to / from the WebAssembly backend must pass through.
            This is the class that the app directly uses to make use of folkfriend.
            It uses comlink and callbacks to communicate with the worker thread,
            which actually loads in the WebAssembly module.
        */

    constructor() {
        const worker = new Worker(new URL('@/services/worker.js', import.meta.url));
        this.folkfriendWorker = Comlink.wrap(worker);

        this.folkfriendWorker.onIndexLoad(Comlink.proxy(() => {
            eventBus.$emit('indexLoaded');
        }));
    }

    async version() {
        return new Promise(resolve => {
            this.folkfriendWorker.version(Comlink.proxy(version => {
                resolve(version);
            }));
        });
    }

    async setupTuneIndex() {
        const analyticsData = await new Promise(resolve => {
            this.folkfriendWorker.setupTuneIndex(Comlink.proxy(analyticsData => {
                resolve(analyticsData);
            }));
        });
        store.logAnalyticsEvent('tune_index_init', analyticsData).then();
    }

    async setSampleRate(sampleRate) {
        // Same check as in folkfriend::feature::signal::validate_sample_rate
        let isValid = sampleRate < ffConfig.SAMPLE_RATE_MAX && sampleRate > ffConfig.SAMPLE_RATE_MIN;
        if (!isValid) {
            throw {
                name: 'SampleRateError',
                message: `Invalid sample rate: ${sampleRate} Hz`
            };
        }

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
        console.time('transcribe-pcm-buffer');
        return new Promise(resolve => {
            this.folkfriendWorker.transcribePCMBuffer(Comlink.proxy(contour => {
                console.timeEnd('transcribe-pcm-buffer');
                resolve(contour);
            }));
        });
    }

    async runTranscriptionQuery(query) {
        console.time('run-transcription-query');
        return new Promise(resolve => {
            this.folkfriendWorker.runTranscriptionQuery(query, Comlink.proxy(response => {
                console.timeEnd('run-transcription-query');
                resolve(response);
            }));
        });
    }

    async submitFilledBuffer() {
        let t0 = performance.now();
        const contour = await this.transcribePCMBuffer();
        let tEnd = performance.now();

        console.debug('contour', contour);

        store.logAnalyticsEvent('transcription', {
            'wall_time': tEnd - t0,
            'contour': contour,
            'contour_length': contour.length,
        }).then();

        try {
            let errorMsg = JSON.parse(contour)['error'];
            if (errorMsg) {
                eventBus.$emit('searchError', errorMsg);
                store.setSearchState(store.searchStates.READY);
                return;
            }
        } catch (e) {
            if (!(e instanceof SyntaxError)) {
                store.setSearchState(store.searchStates.READY);
                throw e;
            }
        }

        // If we have limited the recording time, then the query will probably
        //  be short, and so it's sensible to run a search query. Users can
        //  disable the automatic querying if they desire, for example if
        //  transcribing a new and/or long tune to sheet music.
        const doQuery = !store.userSettings.advancedMode;

        if (doQuery) {
            let t0 = performance.now();
            const queryResults = await this.runTranscriptionQuery(contour);
            let tEnd = performance.now();

            const highestScore = (queryResults[0] || {
                score: 0
            }).score;

            store.logAnalyticsEvent('transcription_query', {
                'wall_time': tEnd - t0,
                'query_length': contour.length,
                'highest_score': highestScore,
            }).then();

            // No point proceeding if not a single sensible note was found...
            if (highestScore === 0) {
                eventBus.$emit('searchError', 'Could not detect any music');
                store.setSearchState(store.searchStates.READY);
                return;
            }

            store.state.lastResults = queryResults;

            router.push({
                name: 'results'
            });
            eventBus.$emit('childViewActivated');
        }

        store.state.lastContour = contour;
        store.addToHistory(new HistoryItem({
            contour: contour
        }));

        if (!doQuery) {
            router.push({
                name: 'notes'
            });
            eventBus.$emit('childViewActivated');
        }

        store.setSearchState(store.searchStates.READY);
    }

    async runNameQuery(query) {
        return new Promise(resolve => {
            this.folkfriendWorker.runNameQuery(query, Comlink.proxy(response => {
                resolve(response);
            }));
        });
    }

    async contourToAbc(contour) {
        return new Promise(resolve => {
            this.folkfriendWorker.contourToAbc(contour, Comlink.proxy(abc => {
                resolve(abc);
            }));
        });
    }

    async settingsFromTuneID(tuneID) {
        return new Promise(resolve => {
            this.folkfriendWorker.settingsFromTuneID(tuneID, Comlink.proxy(response => {
                resolve(response);
            }));
        });
    }

    async aliasesFromTuneID(tuneID) {
        return new Promise(resolve => {
            this.folkfriendWorker.aliasesFromTuneID(tuneID, Comlink.proxy(response => {
                resolve(response);
            }));
        });
    }
}

const ffBackend = new FFBackend();
export default ffBackend;