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

        <v-container class="my-xl-5">
            <v-btn v-on:click="demo" class="mx-auto block">Upload Audio File</v-btn>
        </v-container>

        <v-container class="my-xl-5">
            <v-btn class="mx-auto block">Placeholder Text Search</v-btn>
        </v-container>
        <v-spacer></v-spacer>

        <v-container class="tuneProgress">
            <v-progress-linear
                v-show="progressBar"
                v-model="featureProgress"
                :buffer-value="progressSearching ? 0 : audioProgress"
                :indeterminate="progressSearching"
            ></v-progress-linear>
        </v-container>

        <div id="sheetMusicDemo"></div>
        <ul id="results">
            <li v-for="item in this.$data.tunesTable" v-bind:key="item.setting">
                {{ item.name }} - {{ item.tune }} - {{ item.setting }}
            </li>
        </ul>
        <v-spacer></v-spacer>

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

import abcjs from "abcjs";

export default {
    name: 'Search',
    components: {
        RecorderButton,
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

            progressBar: null,
            progressSearching: null,
            audioProgress: null,
            featureProgress: null,
            maxFramesProgress: null
        };
    },
    methods: {
        recordingStarted: async function () {
            // Doesn't matter if this isn't a short query (transcription mode)
            //  because in that case we don't show the progress bar at all.
            this.maxFramesProgress = Math.floor(0.001 * FFConfig.MAX_SHORT_QUERY_MS * audioService.usingSampleRate / FFConfig.SPEC_WINDOW_SIZE);
            this.startProgressBarAnimation();
        },
        recordingFinished: async function () {
            console.debug('Recording Stopped');

            const decoded = await transcriber.gatherAndDecode();
            this.progressSearching = true;

            // For debugging to "throttle" computer
            await new Promise((resolve => {
                setTimeout(resolve, 2000);
            }));

            if (!decoded) {
                this.noMusicHeard();
                return;
            }

            const result = await queryEngine.query(decoded.midis);
            let tunes = await ds.tunesFromQueryResults(result);
            console.debug(tunes);

            this.renderAbc(tunes[0].abc);

            this.$data.tunesTable = tunes.slice(0, 10);
            this.progressBar = false;
            this.$refs.recorderButton.working = false;
        },
        offlineStarted: async function () {
            // TODO access audioService's sample rate that is has determined
            //  compute times
            //  animate
        },
        computeSearchProgress: async function () {

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

            const t0 = Date.now();

            const timeDomainDataQueue = await audioService.urlToTimeDomainData('audio/fiddle.wav');

            this.maxFramesProgress = Math.floor(timeDomainDataQueue[0].length / FFConfig.SPEC_WINDOW_SIZE);
            console.debug(this.maxFramesProgress);
            this.startProgressBarAnimation();

            const decoded = await transcriber.transcribeTimeDomainData(timeDomainDataQueue);
            console.debug(decoded);

            this.progressSearching = true;

            // For debugging to "throttle" computer
            await new Promise((resolve => {
                setTimeout(resolve, 2000);
            }));

            if (!decoded) {
                this.noMusicHeard();
            }

            const result = await queryEngine.query(decoded.midis);
            console.debug(result);

            let tunes = await ds.tunesFromQueryResults(result);
            console.debug(tunes);

            this.renderAbc(tunes[0].abc);

            this.$data.postProcPerf = Math.round(Date.now() - t0);
            this.$data.tunesTable = tunes.slice(0, 10);

            this.progressBar = false;
            this.$refs.recorderButton.working = false;
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

            // Get rid of the unflexible auto created dimensions / scaling code from the ABCJS library
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

            // If we update too quickly the bar actually doesn't update.
            //  IMO this represents a problem that the Vuetify people should
            //  probably fix...
            //  See https://stackoverflow.com/a/56709798/7919125
            // setTimeout(() => {
            window.requestAnimationFrame(this.progressBarAnimation);
            // }, 200);    // IE run animation at 5ps (but transitions make it smooth)
        }
    },
};

</script>

<style scoped>

.block {
    display: block;
}

.tuneProgress {
    max-width: 60%;
}
</style>
