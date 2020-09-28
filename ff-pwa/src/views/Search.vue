<template>
    <div class="search">

        <!-- TODO These sorts of ref / v-on interactions should be
                replaced with Vuex at some point.-->
        <RecorderButton
            class="mx-auto my-xl-5"
            ref="recorderButton"
            v-on:recording-finish="recordingFinish"
        />

        <v-container class="my-xl-5">
            <v-btn v-on:click="demo" class="mx-auto block">Upload Audio File</v-btn>
        </v-container>

        <v-container class="my-xl-5">
            <v-btn class="mx-auto block">Placeholder Text Search</v-btn>
        </v-container>
        <v-spacer></v-spacer>

        <div id="sheetMusicDemo"></div>
        <ul id="results">
            <li v-for="item in this.$data.tunesTable" v-bind:key="item.setting">
                {{ item.name }}
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

import abcjs from "abcjs";
import audioService from "@/folkfriend/ff-audio";
import transcriber from "@/folkfriend/ff-transcriber.worker";
import queryEngine from "@/folkfriend/ff-query-engine";
import ds from "@/services/database.worker";


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
            snackbarText: null
        };
    },
    methods: {
        recordingFinish: async function () {
            await audioService.stopRecording();
            console.debug('Recording Stopped');

            const decoded = await this.decode();

            if (!decoded) {
                return;
            }

            // For debugging to "throttle" computer
            await new Promise((resolve => {
                setTimeout(resolve, 2000);
            }));

            const result = await queryEngine.query(decoded.midis);
            let tunes = await ds.tunesFromQueryResults(result);
            console.debug(tunes);

            this.renderAbc(tunes[0].abc);

            this.$refs.recorderButton.working = false;
        },
        decode: async function () {
            const decoded = await transcriber.gatherAndDecode();
            if (!decoded) {
                console.warn('No music decoded');
                this.snackbarText = 'No music heard';
                this.snackbar = true;
                this.$refs.recorderButton.working = false;
                return false;
            }
            return decoded;
        },
        demo: async function () {
            this.$refs.recorderButton.working = true;

            const t0 = Date.now();

            const timeDomainDataQueue = await audioService.urlToTimeDomainData('audio/fiddle.wav');
            const decoded = await transcriber.transcribeTimeDomainData(timeDomainDataQueue);
            console.debug(decoded);

            if (!decoded) {
                console.warn('No music decoded');
                return;
            }

            const result = await queryEngine.query(decoded.midis);
            console.debug(result);

            let tunes = await ds.tunesFromQueryResults(result);
            console.debug(tunes);

            this.renderAbc(tunes[0].abc);

            this.$data.postProcPerf = Math.round(Date.now() - t0);
            this.$data.tunesTable = tunes.slice(0, 10);

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

            sheetMusicSvg.setAttribute('style', 'max-width: 80vw; max-height: 70vh; display: block; margin: auto;');

            // There's a race condition between applying the viewbox and drawing the SVG on the page,
            //  hence this delay here.
            setTimeout(() => {
                let viewBoxString = '0 0 ' + svgWidth.toFixed(1) + ' ' + svgHeight.toFixed(1);
                sheetMusicSvg.setAttribute('viewBox', viewBoxString);
            }, 20);


        }
    }
};


</script>

<style scoped>

.block {
    display: block;
}
</style>
