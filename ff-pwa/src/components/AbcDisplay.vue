<template>
    <v-card elevation="0">
        <v-container class="ma-0 pa-0">
            <span class="abcTextView mx-auto">{{ this.abcText }}</span>
        </v-container>
        <div>
            <!-- Render ABC sheet music here -->
            <div></div>
            <!-- Render MIDI thing here -->
            <div style="display: none"></div>
        </div>
        <v-row wrap justify="center">
            <v-btn
                class="mx-1"
                @click="startPlaying">
                <v-icon>{{ paused ? 'pause' : 'play_arrow' }}</v-icon>
            </v-btn>
            <v-btn
                class="mx-1"
                @click="stopPlaying">
                <v-icon>stop</v-icon>
            </v-btn>
            <v-btn
                class="mx-1"
                @click="restartPlaying">
                <v-icon>replay</v-icon>
            </v-btn>
        </v-row>
    </v-card>
</template>

<script>
/* eslint-disable */

import abcjs from "abcjs/midi";

export default {
    name: "AbcDisplay",
    mounted: async function () {
        const abcJsWrapperDiv = this.$el.childNodes[1];
        const svgDiv = abcJsWrapperDiv.firstChild;
        const midDiv = abcJsWrapperDiv.lastChild;

        abcjs.renderAbc(svgDiv, this.abcText, {responsive: 'resize'});

        abcjs.renderMidi(midDiv, this.abcText, {});
        this.midPlayDiv = midDiv.lastChild;
    },
    data: function () {
        return {
            midPlayDiv: null,
            paused: false,
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
            return abcLines.join('\n');
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
            abcjs.midi.startPlaying(this.midPlayDiv);
        },
        stopPlaying: function () {
            this.paused = false;
            abcjs.midi.stopPlaying();
        },
        restartPlaying: function () {
            this.paused = false;
            abcjs.midi.restartPlaying();
        }
    },
};
</script>

<style scoped>
.abcTextView {
    font-family: Courier, serif;
    white-space: pre-wrap;
    display: inline-block;
}
</style>