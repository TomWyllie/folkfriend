<template>
    <div class="search">

        <!--suppress CssInvalidFunction, CssInvalidPropertyValue -->
        <HelloWorld/>

        <RecorderButton class="mx-auto" v-on:recording-finish="recordingFinish"/>

        <v-container>
            <v-btn v-on:click="demo">Demo from .WAV file</v-btn>
        </v-container>

        <span class="block">Performance: {{ this.$data.postProcPerf }} ms</span>
        <ul id="results">
            <li v-for="item in this.$data.tunesTable" v-bind:key="item.setting">
                {{ item.name }}
            </li>
        </ul>

        <v-snackbar class="text-center" v-model="snackbar" :timeout="3000">
            {{ snackbarText }}
        </v-snackbar>
    </div>
</template>

<script>
import HelloWorld from "@/components/HelloWorld.vue";
import RecorderButton from "@/components/RecorderButton";

import audioService from "@/folkfriend/ff-audio";
import transcriber from "@/folkfriend/ff-transcriber.worker";
import queryEngine from "@/folkfriend/ff-query-engine";
import ds from "../services/database.worker";

export default {
    name: 'Search',
    components: {
        RecorderButton,
        HelloWorld
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
        async recordingFinish() {
            await audioService.stopRecording();
            console.debug('Recording Stopped');

            const decoded = await transcriber.gatherAndDecode();

            if (!decoded) {
                console.warn('No music decoded');
                this.snackbarText = 'No music heard';
                this.snackbar = true;
                return;
            }

            const result = await queryEngine.query(decoded.midis);
            console.debug(result);

            let tunes = await ds.tunesFromQueryResults(result);
            console.debug(tunes);
        },

        demo: async function () {
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

            this.$data.postProcPerf = Math.round(Date.now() - t0);
            this.$data.tunesTable = tunes.slice(0, 10);
        },
    }
};


</script>

<style scoped>

.block {
    display: block;
}

</style>
