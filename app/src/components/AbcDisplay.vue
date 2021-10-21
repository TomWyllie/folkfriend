<template>
    <v-card elevation="0">
        <v-container class="ma-0 pa-0" v-if="showAbcText">
            <span class="abcTextView mx-auto">{{ this.abcText }}</span>
        </v-container>
        <div
            @click="exitFullScreen"
            v-bind:class="{ FullScreenAbcDisplay: fullscreen }"
            class="abcSheetMusic"
        >
            <!-- Render ABC sheet music here -->
            <div></div>
            <!-- Render MIDI thing here -->
            <div style="display: none"></div>
        </div>
        <v-row wrap justify="center" class="py-2">
            <v-btn class="mx-1 px-3 abcControls" @click="restartPlaying">
                <v-icon>{{ icons.replay }}</v-icon>
            </v-btn>
            <v-btn class="mx-1 px-3 abcControls" @click="startPlaying">
                <v-icon v-if="paused">{{ icons.play }}</v-icon>
                <v-icon v-else>{{ icons.pause }}</v-icon>
            </v-btn>
            <v-btn class="mx-1 px-3 abcControls" @click="stopPlaying">
                <v-icon>{{ icons.stop }}</v-icon>
            </v-btn>
            <v-btn class="mx-1 px-3 abcControls" @click="goFullScreen">
                <v-icon>{{ icons.fullscreen }}</v-icon>
            </v-btn>
        </v-row>
    </v-card>
</template>

<script>
import abcjs from "abcjs/midi";
import { mdiFullscreen, mdiPause, mdiPlay, mdiReplay, mdiStop } from "@mdi/js";
import store from "@/services/store.js";

export default {
    name: "AbcDisplay",
    mounted: async function () {
        const abcJsWrapperDiv = this.$el.childNodes[1];
        const svgDiv = abcJsWrapperDiv.firstChild;
        const midDiv = abcJsWrapperDiv.lastChild;

        abcjs.renderAbc(svgDiv, this.abcText, { responsive: "resize" });

        abcjs.renderMidi(midDiv, this.abcText, {});
        this.midPlayDiv = midDiv.lastChild;
    },
    data: function () {
        return {
            midPlayDiv: null,
            paused: true,
            fullscreen: false,

            icons: {
                fullscreen: mdiFullscreen,
                pause: mdiPause,
                play: mdiPlay,
                replay: mdiReplay,
                stop: mdiStop,
            },
        };
    },
    computed: {
        abcText: function () {
            const abcLines = [];
            if (this.mode) {
                abcLines.push(`K:${this.mode}`);
            }
            if (this.meter) {
                abcLines.push(`M:${this.meter}`);
            }
            abcLines.push(this.abc);
            return abcLines.join("\n");
        },
        showAbcText: function () {
            return store.userSettings.showAbcText;
        },
    },
    props: {
        abc: {
            type: String,
        },
        mode: {
            type: String,
        },
        meter: {
            type: String,
        },
    },
    methods: {
        startPlaying: function () {
            this.paused = !this.paused;

            // TODO can desync the pause button by messing around with controls on another setting
            abcjs.midi.startPlaying(this.midPlayDiv);
        },
        stopPlaying: function () {
            this.paused = true;
            abcjs.midi.stopPlaying();
        },
        restartPlaying: function () {
            abcjs.midi.restartPlaying();
        },
        goFullScreen: function () {
            this.$emit("abcGoFullScreen");
            this.fullscreen = true;
        },
        exitFullScreen: function () {
            this.$emit("abcExitFullScreen");
            this.fullscreen = false;
        },
    },
};
</script>

<style scoped>
.abcTextView {
    font-family: Courier, serif;
    white-space: pre-wrap;
    display: inline-block;
}

.FullScreenAbcDisplay {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: white;
    overflow-y: scroll;

    /* TODO z index flicker here isn't great */
    z-index: 10;
}

.FullScreenAbcDisplay > div {
    min-height: 100%;
}

.abcControls {
    min-width: 0 !important;
}

</style>