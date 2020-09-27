<template>
    <div class="search">

        <!--suppress CssInvalidFunction, CssInvalidPropertyValue -->
        <HelloWorld/>

        <RecorderButton class="mx-auto"/>

        <v-container>
            <v-btn v-on:click="startRecording">Start Recording</v-btn>
            <v-btn v-on:click="stopRecording">Stop Recording</v-btn>
            <v-btn v-on:click="demo">Demo from .WAV file</v-btn>
        </v-container>

        <span class="block">Performance: {{ this.$data.postProcPerf }} ms</span>
        <ul id="results">
            <li v-for="item in this.$data.tunesTable" v-bind:key="item.setting">
                {{ item.name }}
            </li>
        </ul>
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
            postProcPerf: 0
        };
    },
    methods: {
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

        startRecording: async function () {
            await audioService.startRecording();
        },
        stopRecording: async function () {
            const t0 = Date.now();

            console.debug('Audio stopping');
            await audioService.stopRecording();
            console.debug('Audio stopped');

            const decoded = await transcriber.gatherAndDecode();
            // this.renderImageForDebug(decoded);
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
