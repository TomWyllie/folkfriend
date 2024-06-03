<template>
    <v-card elevation="0">
        <v-container
            v-if="showAbcText"
            class="ma-0 pa-0"
        >
            <span class="abcTextView mx-auto">{{ abcText }}</span>
        </v-container>
        <div
            :class="{ FullScreenAbcDisplay: fullscreen }"
            class="abcSheetMusic"
            @click="exitFullScreen"
        >
            <!-- Render ABC sheet music here -->
            <div />
            <!-- Render MIDI thing here -->
            <div style="display: none" />
        </div>
        <v-row
            wrap
            justify="center"
            class="py-2"
        >
            <!-- <v-btn
                class="mx-1 px-3 abcControls"
                @click="restartPlaying"
            >
                <v-icon>{{ icons.replay }}</v-icon>
            </v-btn> -->
            <v-btn
                class="mx-1 px-3 abcControls"
                @click="startPlaying"
            >
                <v-icon v-if="paused">
                    {{ icons.play }}
                </v-icon>
                <v-icon v-else>
                    {{ icons.pause }}
                </v-icon>
            </v-btn>
            <v-btn
                class="mx-1 px-3 abcControls"
                @click="stopPlaying"
            >
                <v-icon>{{ icons.stop }}</v-icon>
            </v-btn>
            <v-btn
                class="mx-1 px-3 abcControls"
                @click="goFullScreen"
            >
                <v-icon>{{ icons.fullscreen }}</v-icon>
            </v-btn>
        </v-row>
    </v-card>
</template>

<script>
import { mdiArrowExpand, mdiPause, mdiPlay, mdiStop } from '@mdi/js';
import store from '@/services/store.js';
import abcjs from 'abcjs/midi';

export default {
    name: 'AbcDisplay',
    props: {
        abc: {
            type: String,
            required: true,
        },
        mode: {
            type: String,
            required: false,
            default: null
        },
        meter: {
            type: String,
            required: false,
            default: null
        },
    },
    data: function () {
        return {
            midPlayDiv: null,
            paused: true,
            fullscreen: false,

            icons: {
                fullscreen: mdiArrowExpand,
                pause: mdiPause,
                play: mdiPlay,
                // replay: mdiReplay,
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
            return abcLines.join('\n');
        },
        showAbcText: function () {
            return store.userSettings.showAbcText;
        },
    },
    mounted: async function () {
        const abcJsWrapperDiv = this.$el.childNodes[1];
        const svgDiv = abcJsWrapperDiv.firstChild;
        const midDiv = abcJsWrapperDiv.lastChild;

        abcjs.renderAbc(svgDiv, this.abcText, { responsive: 'resize' });
        abcjs.renderMidi(midDiv, this.abcText, {});
        this.midPlayDiv = midDiv.lastChild;
        this.$emit('abcRendered');
    },
    methods: {
        startPlaying: function () {
            this.paused = !this.paused;

            // Can create an AudioContext here because are inside the context of a button press
            window.AudioContext = window.AudioContext ||
                            window.webkitAudioContext ||
                            navigator.mozAudioContext ||
                            navigator.msAudioContext;

            let audioContext = new window.AudioContext();

            audioContext.resume().then(() => {
                // In theory the AC shouldn't start suspended because it is being initialized in a click handler, but iOS seems to anyway.

                // This does a bare minimum so this object could be created in advance, or whenever convenient.
                this.midiBuffer = new ABCJS.synth.CreateSynth();

                // midiBuffer.init preloads and caches all the notes needed. There may be significant network traffic here.
                return this.midiBuffer.init({
                    visualObj: this.abcVisual,
                    audioContext: audioContext,
                    millisecondsPerMeasure: this.abcVisual.millisecondsPerMeasure()
                }).then(response => {
                    // midiBuffer.prime actually builds the output buffer.
                    return this.midiBuffer.prime();
                }).then(response => {
                    // At this point, everything slow has happened. midiBuffer.start will return very quickly and will start playing very quickly without lag.
                    this.midiBuffer.start();
                    this.midiBuffer.onEnded = () => {
                        if(!this.paused) {
                            this.stopPlaying();
                        }
                    };
                    return Promise.resolve();
                }).catch(error => {
                    console.error("AudioContext error", error);
                })
            });
        },
        stopPlaying: function () {
            this.paused = true;
            abcjs.midi.stopPlaying();
        },
        // restartPlaying: function () {
        //     abcjs.midi.restartPlaying();
        // },
        goFullScreen: function () {
            this.$emit('abcGoFullScreen');
            this.fullscreen = true;
        },
        exitFullScreen: function () {
            this.$emit('abcExitFullScreen');
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