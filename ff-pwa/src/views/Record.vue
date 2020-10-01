<template>
    <div class="search">

        <!-- TODO These sorts of ref / v-on interactions should be
                replaced with Vuex at some point.-->
        <RecorderButton
            class="mx-auto my-xl-5"
            ref="recorderButton"
            v-on:recording-finished="recordingFinished"
            v-on:recording-started="recordingStarted"
            v-on:offline-start="offlineStarted"
        />

        <v-container>
            <v-row wrap justify="center">
                <v-btn
                    v-on:click="demo"
                    :disabled="!offlineButton"
                    class="mx-auto">Upload Audio File
                </v-btn>
            </v-row>
        </v-container>

        <v-container>
            <v-row wrap justify="center">
                <v-col
                    class="mx-auto pt-5 pb-0"
                    sm="6"
                    md="8">
                    <v-text-field
                        label="Search By Tune Name"
                        outlined
                        v-model="textQuery"
                        @keypress.enter="runTextQuery">
                        <template v-slot:append>
                            <v-icon @click="runTextQuery">search</v-icon>
                        </template>
                    </v-text-field>
                </v-col>
            </v-row>
        </v-container>

        <v-container class="transcriptionSwitch py-0">
            <v-row wrap justify="center">
                <!--            <v-tooltip bottom>-->
                <!--                <template v-slot:activator="{ on, attrs }">-->
                <!--                    <v-icon-->
                <!--                        v-bind="attrs"-->
                <!--                        v-on="on"-->
                <!--                    >help-->
                <!--                    </v-icon>-->
                <!--                </template>-->
                <!--                <span >Removes recording limit, doesn't search database</span>-->
                <!--            </v-tooltip>-->
                <v-switch
                    v-model="transcriptionMode"
                    inset
                    class="mx-auto"
                    :label="`Transcription Mode`"
                ></v-switch>
            </v-row>
        </v-container>

        <v-container class="tuneProgress">
            <v-progress-linear
                v-show="progressBar"
                v-model="featureProgress"
                :buffer-value="progressSearching ? 0 : audioProgress"
                :indeterminate="progressSearching"
            ></v-progress-linear>
        </v-container>

        <v-snackbar class="text-center" v-model="snackbar" :timeout="3000">
            {{ snackbarText }}
        </v-snackbar>
    </div>
</template>

<script>
import RecorderButton from "@/components/RecorderButton";

import audioService from "@/folkfriend/ff-audio";
import FFConfig from "@/folkfriend/ff-config";
import queryEngine from "@/folkfriend/ff-query-engine";
import transcriber from "@/folkfriend/ff-transcriber.worker";
import ds from "@/services/database.worker";
import store from "@/services/store";


import abcjs from "abcjs";

export default {
    name: 'Search',
    components: {
        RecorderButton
    },
    mounted: function () {
        console.debug('Home loaded');
    },
    data() {
        return {
            tunesTable: [],
            postProcPerf: 0,
            snackbar: null,
            snackbarText: null,

            transcriptionMode: null,
            textQuery: '',

            offlineButton: true,
            progressBar: null,
            progressSearching: null,
            audioProgress: null,
            featureProgress: null,
            maxFramesProgress: null
        };
    },
    methods: {
        runTextQuery: async function () {
            const textSearchResults = await ds.runNamedSearchQuery(this.textQuery);
            if(textSearchResults === false) {
                this.snackbarText = 'No matches found';
                this.snackbar = true;
            } else {
                this.registerNewSearch(textSearchResults);
            }
        },
        recordingStarted: async function () {
            // Doesn't matter if this isn't a short query (transcription mode)
            //  because in that case we don't show the progress bar at all.
            this.maxFramesProgress = Math.floor(0.001 * FFConfig.MAX_SHORT_QUERY_MS * audioService.usingSampleRate / FFConfig.SPEC_WINDOW_SIZE);
            if (!this.transcriptionMode) {
                this.startProgressBarAnimation();
            }
        },
        recordingFinished: async function () {
            console.debug('Recording Stopped');

            if (this.transcriptionMode) {
                this.maxFramesProgress = (await transcriber.getProgress()).audio;
                await this.startProgressBarAnimation();
            }

            const decoded = await transcriber.gatherAndDecode();
            this.progressSearching = true;

            // For debugging to "throttle" computer
            await new Promise((resolve => {
                setTimeout(resolve, 1000);
            }));

            if (!decoded) {
                this.noMusicHeard();
                return;
            }

            if (this.transcriptionMode) {
                // Switch to transcriptions panel and show transcription
                this.registerNewTranscription(decoded);
            } else {
                const midiQuery = await queryEngine.query(decoded.midis);
                let tunes = await ds.settingsFromMidiQuery(midiQuery);
                this.registerNewSearch(tunes);
            }

            this.progressBar = false;
            this.$refs.recorderButton.working = false;
        },
        offlineStarted: async function () {
            this.offlineButton = false;
            // TODO access audioService's sample rate that is has determined
            //  compute times
            //  animate
        },
        noMusicHeard: function () {
            console.warn('No music decoded');
            this.snackbarText = 'No music heard';
            this.snackbar = true;
            this.$refs.recorderButton.working = false;
            this.progressBar = false;
        },
        demo: async function () {
            this.$refs.recorderButton.working = true;
            this.offlineButton = false;

            try {
                const timeDomainDataQueue = await audioService.urlToTimeDomainData('audio/fiddle.wav');

                this.maxFramesProgress = Math.floor(timeDomainDataQueue[0].length / FFConfig.SPEC_WINDOW_SIZE);
                this.startProgressBarAnimation();

                const decoded = await transcriber.transcribeTimeDomainData(timeDomainDataQueue);
                this.progressSearching = true;

                console.debug(decoded);

                // For debugging to "throttle" computer
                await new Promise((resolve => {
                    setTimeout(resolve, 1000);
                }));

                if (!decoded) {
                    this.noMusicHeard();
                }

                if(this.transcriptionMode) {
                    this.registerNewTranscription(decoded);
                } else {
                    const midiQuery = await queryEngine.query(decoded.midis);
                    let tunes = await ds.settingsFromMidiQuery(midiQuery);
                    this.registerNewSearch(tunes);
                }

            } catch (e) {
                // We need to make sure that the UI update code at the
                //  end runs even if there's any exceptions. Otherwise
                //  bad things happen like the offline audio button being
                //  stuck in the disabled state.
                console.error(e);
            }

            this.offlineButton = true;
            this.progressBar = false;
            this.$refs.recorderButton.working = false;
        },
        registerNewSearch: function (tunes) {
            store.setEntry('lastSearch', tunes.slice(0, 20));
            this.$router.push({name: 'searches'});
        },
        registerNewTranscription: function(decoded) {
            store.setEntry('lastTranscription', decoded);
            this.$router.push({name: 'transcriptions'});
        },
        renderAbc: function (abc) {

            // El cheapo implementation. Straight render best tune.
            const sheetMusicID = 'sheetMusicDemo';
            abcjs.renderAbc(sheetMusicID, abc, {});

            // FolkFriend v1
            // https://bitbucket.org/Tom_Wyllie/folk-friend-web-app/src/master/app/js/folkfriend-app.js

            // TODO on iOS this sheetMusicWrapper element has been null sometimes..?
            let sheetMusicWrapper = document.getElementById(sheetMusicID);
            let sheetMusicSvg = sheetMusicWrapper.firstChild;

            let svgWidth = sheetMusicSvg.width.baseVal.value;
            let svgHeight = sheetMusicSvg.height.baseVal.value;

            // Get rid of the inflexible auto created dimensions / scaling code from the ABCJS library
            sheetMusicSvg.removeAttribute('height');
            sheetMusicSvg.removeAttribute('width');
            sheetMusicWrapper.removeAttribute('style');

            sheetMusicSvg.setAttribute('style', 'max-width: 80%; max-height: 70%; display: block; margin: auto;');

            // There's a race condition between applying the viewbox and drawing the SVG on the page,
            //  hence this delay here.
            setTimeout(() => {
                let viewBoxString = '0 0 ' + svgWidth.toFixed(1) + ' ' + svgHeight.toFixed(1);
                sheetMusicSvg.setAttribute('viewBox', viewBoxString);
            }, 20);
        },
        startProgressBarAnimation() {
            this.progressBar = true;
            this.progressSearching = false;
            this.audioProgress = 0;
            this.featureProgress = 0;
            window.requestAnimationFrame(this.progressBarAnimation);
        },
        progressBarAnimation: async function () {
            if (!this.progressBar || this.progressSearching) {
                return;
            }

            // These are in number of frames
            const {audio, features} = await transcriber.getProgress();
            this.audioProgress = 100 * audio / this.maxFramesProgress; // Percent
            this.featureProgress = 100 * features / this.maxFramesProgress; // Percent

            window.requestAnimationFrame(this.progressBarAnimation);
        }
    },
    watch: {
        transcriptionMode: function () {
            // TODO this is an anti-pattern. Should be replaced by better
            //  separation between button and this search, or vuex.
            this.$refs.recorderButton.transcriptionMode = this.transcriptionMode;
        }
    }
};

</script>

<style scoped>
.tuneProgress {
    max-width: 60%;
}

.transcriptionSwitch {
    max-width: 70%;
}
</style>
