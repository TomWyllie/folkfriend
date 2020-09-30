<!--suppress CssUnusedSymbol, CssUnresolvedCustomProperty -->
<template>
    <div>
        <transition name="fade" mode="out-in">
            <svg class="RecorderButton mx-auto"
                 xmlns="http://www.w3.org/2000/svg"
                 viewBox="-1 -1 26 26"
                 :style="cssProps"
                 v-on:click=clicked
                 v-if="!working"
                 key="recorder"
            >
                <circle
                    class="RecorderCircle"
                    cx="12"
                    cy="12"
                    r="12"
                    v-bind:class="{RecorderActive: recording}"
                ></circle>
                <path
                    class="RecorderMic"
                    fill="secondary"
                    v-bind:class="{RecorderActive: recording}"
                    d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z"></path>
                <rect
                    class="RecorderRect"
                    x="7.5"
                    y="7.5"
                    rx="0.9"
                    ry="0.9"
                    width="9"
                    height="9"
                    v-bind:class="{RecorderActive: recording}"
                ></rect>
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg"
                 viewBox="-400 -400 800 800"
                 preserveAspectRatio="xMidYMid meet"
                 class="WorkingGears mx-auto"
                 v-else
                 key="gears"
            >
                <path class="ff-gear-1" :style="cssProps"
                      d="M 115.3243179321289 72.06262969970703 l -3.29 4.94l -3.60 4.71l -4.19 4.22l -5.78 2.73l -9.40 -1.13l -11.93 -4.81l -8.63 -2.51l -5.17 0.86l -3.99 2.13l -3.78 2.37l -3.81 2.31l -3.88 2.17l -3.96 2.04l -4.00 1.98l -3.90 2.29l -3.43 3.95l -2.37 8.67l -2.14 12.68l -3.95 8.60l -5.34 3.50l -5.79 1.37l -5.90 0.60l -5.93 0.22l -5.93 -0.08l -5.92 -0.38l -5.88 -0.76l -5.75 -1.52l -5.25 -3.64l -3.72 -8.70l -1.80 -12.73l -2.14 -8.73l -3.33 -4.04l -3.84 -2.39l -3.94 -2.08l -3.90 -2.14l -3.83 -2.28l -3.74 -2.41l -3.71 -2.47l -3.93 -2.24l -5.14 -1.00l -8.69 2.28l -12.05 4.49l -9.42 0.88l -5.71 -2.88l -4.08 -4.33l -3.47 -4.81l -3.15 -5.02l -2.90 -5.18l -2.64 -5.31l -2.28 -5.47l -1.56 -5.74l 0.53 -6.37l 5.68 -7.57l 10.13 -7.93l 6.49 -6.22l 1.84 -4.90l 0.15 -4.52l -0.17 -4.46l -0.10 -4.45l 0.06 -4.45l 0.21 -4.45l 0.28 -4.45l -0.03 -4.53l -1.71 -4.95l -6.32 -6.39l -9.92 -8.19l -5.48 -7.72l -0.36 -6.38l 1.71 -5.70l 2.43 -5.41l 2.77 -5.24l 3.03 -5.10l 3.29 -4.94l 3.60 -4.71l 4.19 -4.22l 5.78 -2.73l 9.40 1.13l 11.93 4.81l 8.63 2.51l 5.17 -0.86l 3.99 -2.13l 3.78 -2.37l 3.81 -2.31l 3.88 -2.17l 3.96 -2.04l 4.00 -1.98l 3.90 -2.29l 3.43 -3.95l 2.37 -8.67l 2.14 -12.68l 3.95 -8.60l 5.34 -3.50l 5.79 -1.37l 5.90 -0.60l 5.93 -0.22l 5.93 0.08l 5.92 0.38l 5.88 0.76l 5.75 1.52l 5.25 3.64l 3.72 8.70l 1.80 12.73l 2.14 8.73l 3.33 4.04l 3.84 2.39l 3.94 2.08l 3.90 2.14l 3.83 2.28l 3.74 2.41l 3.71 2.47l 3.93 2.24l 5.14 1.00l 8.69 -2.28l 12.05 -4.49l 9.42 -0.88l 5.71 2.88l 4.08 4.33l 3.47 4.81l 3.15 5.02l 2.90 5.18l 2.64 5.31l 2.28 5.47l 1.56 5.74l -0.53 6.37l -5.68 7.57l -10.13 7.93l -6.49 6.22l -1.84 4.90l -0.15 4.52l 0.17 4.46l 0.10 4.45l -0.06 4.45l -0.21 4.45l -0.28 4.45l 0.03 4.53l 1.71 4.95l 6.32 6.39l 9.92 8.19l 5.48 7.72l 0.36 6.38l -1.71 5.70l -2.43 5.41l -2.77 5.24 z"/>
                <circle class="ff-centre-1" r="36" :style="cssProps"></circle>
                <path class="ff-gear-2" :style="cssProps"
                      d="M 203.99978637695312 0.0 l -0.07 5.34l -0.22 5.34l -0.48 5.32l -1.59 5.20l -7.88 4.32l -17.38 2.43l -7.99 3.27l -1.96 4.17l -1.11 4.31l -1.11 4.31l -1.21 4.28l -1.32 4.25l -1.43 4.21l -1.53 4.18l -1.53 4.18l -0.75 4.54l 4.73 7.22l 12.94 11.84l 4.05 8.02l -1.63 5.19l -2.62 4.65l -2.84 4.52l -2.97 4.44l -3.08 4.36l -3.20 4.28l -3.32 4.18l -3.51 4.02l -4.34 3.27l -8.91 -1.14l -15.48 -8.25l -8.39 -2.05l -4.03 2.22l -3.43 2.84l -3.43 2.83l -3.50 2.75l -3.57 2.66l -3.63 2.57l -3.69 2.49l -3.70 2.49l -3.27 3.24l -0.42 8.62l 3.51 17.19l -1.44 8.87l -4.37 3.24l -4.85 2.23l -4.95 1.99l -5.01 1.85l -5.06 1.72l -5.10 1.58l -5.14 1.44l -5.21 1.19l -5.44 0.09l -6.54 -6.16l -7.68 -15.77l -5.58 -6.59l -4.57 -0.58l -4.45 0.28l -4.44 0.28l -4.45 0.17l -4.45 0.06l -4.45 -0.06l -4.45 -0.16l -4.45 -0.16l -4.55 0.70l -5.41 6.73l -7.26 15.97l -6.38 6.33l -5.44 0.05l -5.24 -1.05l -5.18 -1.30l -5.14 -1.45l -5.10 -1.58l -5.06 -1.72l -5.01 -1.86l -4.91 -2.10l -4.45 -3.12l -1.67 -8.83l 3.06 -17.27l -0.64 -8.61l -3.36 -3.15l -3.76 -2.39l -3.76 -2.39l -3.70 -2.47l -3.63 -2.57l -3.57 -2.66l -3.50 -2.74l -3.51 -2.75l -4.09 -2.11l -8.33 2.27l -15.26 8.65l -8.88 1.37l -4.43 -3.16l -3.62 -3.93l -3.43 -4.10l -3.31 -4.19l -3.20 -4.28l -3.08 -4.36l -2.95 -4.45l -2.74 -4.58l -1.77 -5.14l 3.84 -8.12l 12.63 -12.18l 4.54 -7.34l -0.86 -4.52l -1.64 -4.14l -1.64 -4.14l -1.54 -4.18l -1.43 -4.21l -1.32 -4.25l -1.22 -4.28l -1.22 -4.28l -2.07 -4.11l -8.07 -3.06l -17.43 -1.97l -7.99 -4.11l -1.73 -5.15l -0.62 -5.30l -0.36 -5.33l -0.21 -5.34l -0.07 -5.34l 0.07 -5.34l 0.22 -5.34l 0.48 -5.32l 1.59 -5.20l 7.88 -4.32l 17.38 -2.43l 7.99 -3.27l 1.96 -4.17l 1.11 -4.31l 1.11 -4.31l 1.21 -4.28l 1.32 -4.25l 1.43 -4.21l 1.53 -4.18l 1.53 -4.18l 0.75 -4.54l -4.73 -7.22l -12.94 -11.84l -4.05 -8.02l 1.63 -5.19l 2.62 -4.65l 2.84 -4.52l 2.97 -4.44l 3.08 -4.36l 3.20 -4.28l 3.32 -4.18l 3.51 -4.02l 4.34 -3.27l 8.91 1.14l 15.48 8.25l 8.39 2.05l 4.03 -2.22l 3.43 -2.84l 3.43 -2.83l 3.50 -2.75l 3.57 -2.66l 3.63 -2.57l 3.69 -2.49l 3.70 -2.49l 3.27 -3.24l 0.42 -8.62l -3.51 -17.19l 1.44 -8.87l 4.37 -3.24l 4.85 -2.23l 4.95 -1.99l 5.01 -1.85l 5.06 -1.72l 5.10 -1.58l 5.14 -1.44l 5.21 -1.19l 5.44 -0.09l 6.54 6.16l 7.68 15.77l 5.58 6.59l 4.57 0.58l 4.45 -0.28l 4.44 -0.28l 4.45 -0.17l 4.45 -0.06l 4.45 0.06l 4.45 0.16l 4.45 0.16l 4.55 -0.70l 5.41 -6.73l 7.26 -15.97l 6.38 -6.33l 5.44 -0.05l 5.24 1.05l 5.18 1.30l 5.14 1.45l 5.10 1.58l 5.06 1.72l 5.01 1.86l 4.91 2.10l 4.45 3.12l 1.67 8.83l -3.06 17.27l 0.64 8.61l 3.36 3.15l 3.76 2.39l 3.76 2.39l 3.70 2.47l 3.63 2.57l 3.57 2.66l 3.50 2.74l 3.51 2.75l 4.09 2.11l 8.33 -2.27l 15.26 -8.65l 8.88 -1.37l 4.43 3.16l 3.62 3.93l 3.43 4.10l 3.31 4.19l 3.20 4.28l 3.08 4.36l 2.95 4.45l 2.74 4.58l 1.77 5.14l -3.84 8.12l -12.63 12.18l -4.54 7.34l 0.86 4.52l 1.64 4.14l 1.64 4.14l 1.54 4.18l 1.43 4.21l 1.32 4.25l 1.22 4.28l 1.22 4.28l 2.07 4.11l 8.07 3.06l 17.43 1.97l 7.99 4.11l 1.73 5.15l 0.62 5.30l 0.36 5.33l 0.21 5.34 z"/>
                <circle class="ff-centre-2" r="36" :style="cssProps"></circle>
                <path class="ff-gear-3" :style="cssProps"
                      d="M 139.25457763671875 97.50711059570312 l -3.27 4.50l -3.45 4.36l -3.78 4.09l -4.96 2.98l -9.27 -1.38l -13.73 -6.77l -8.62 -2.47l -4.53 1.64l -3.65 2.58l -3.58 2.65l -3.64 2.57l -3.71 2.45l -3.79 2.34l -3.84 2.25l -3.80 2.34l -3.28 3.52l -1.11 8.90l 0.83 15.29l -2.37 9.06l -4.69 3.39l -5.24 1.87l -5.37 1.46l -5.42 1.24l -5.46 1.06l -5.49 0.87l -5.52 0.65l -5.56 0.22l -5.62 -1.40l -5.58 -7.53l -4.93 -14.50l -4.35 -7.85l -4.36 -2.04l -4.40 -0.76l -4.40 -0.65l -4.39 -0.76l -4.36 -0.89l -4.33 -1.03l -4.31 -1.13l -4.35 -1.03l -4.81 0.17l -7.08 5.51l -10.23 11.40l -8.08 4.73l -5.71 -0.92l -5.03 -2.38l -4.83 -2.76l -4.71 -2.96l -4.61 -3.12l -4.50 -3.27l -4.36 -3.45l -4.09 -3.78l -2.98 -4.96l 1.38 -9.27l 6.77 -13.73l 2.47 -8.62l -1.64 -4.53l -2.58 -3.65l -2.65 -3.58l -2.57 -3.64l -2.45 -3.71l -2.34 -3.79l -2.25 -3.84l -2.34 -3.80l -3.52 -3.28l -8.90 -1.11l -15.29 0.83l -9.06 -2.37l -3.39 -4.69l -1.87 -5.24l -1.46 -5.37l -1.24 -5.42l -1.06 -5.46l -0.87 -5.49l -0.65 -5.52l -0.22 -5.56l 1.40 -5.62l 7.53 -5.58l 14.50 -4.93l 7.85 -4.35l 2.04 -4.36l 0.76 -4.40l 0.65 -4.40l 0.76 -4.39l 0.89 -4.36l 1.03 -4.33l 1.13 -4.31l 1.03 -4.35l -0.17 -4.81l -5.51 -7.08l -11.40 -10.23l -4.73 -8.08l 0.92 -5.71l 2.38 -5.03l 2.76 -4.83l 2.96 -4.71l 3.12 -4.61l 3.27 -4.50l 3.45 -4.36l 3.78 -4.09l 4.96 -2.98l 9.27 1.38l 13.73 6.77l 8.62 2.47l 4.53 -1.64l 3.65 -2.58l 3.58 -2.65l 3.64 -2.57l 3.71 -2.45l 3.79 -2.34l 3.84 -2.25l 3.80 -2.34l 3.28 -3.52l 1.11 -8.90l -0.83 -15.29l 2.37 -9.06l 4.69 -3.39l 5.24 -1.87l 5.37 -1.46l 5.42 -1.24l 5.46 -1.06l 5.49 -0.87l 5.52 -0.65l 5.56 -0.22l 5.62 1.40l 5.58 7.53l 4.93 14.50l 4.35 7.85l 4.36 2.04l 4.40 0.76l 4.40 0.65l 4.39 0.76l 4.36 0.89l 4.33 1.03l 4.31 1.13l 4.35 1.03l 4.81 -0.17l 7.08 -5.51l 10.23 -11.40l 8.08 -4.73l 5.71 0.92l 5.03 2.38l 4.83 2.76l 4.71 2.96l 4.61 3.12l 4.50 3.27l 4.36 3.45l 4.09 3.78l 2.98 4.96l -1.38 9.27l -6.77 13.73l -2.47 8.62l 1.64 4.53l 2.58 3.65l 2.65 3.58l 2.57 3.64l 2.45 3.71l 2.34 3.79l 2.25 3.84l 2.34 3.80l 3.52 3.28l 8.90 1.11l 15.29 -0.83l 9.06 2.37l 3.39 4.69l 1.87 5.24l 1.46 5.37l 1.24 5.42l 1.06 5.46l 0.87 5.49l 0.65 5.52l 0.22 5.56l -1.40 5.62l -7.53 5.58l -14.50 4.93l -7.85 4.35l -2.04 4.36l -0.76 4.40l -0.65 4.40l -0.76 4.39l -0.89 4.36l -1.03 4.33l -1.13 4.31l -1.03 4.35l 0.17 4.81l 5.51 7.08l 11.40 10.23l 4.73 8.08l -0.92 5.71l -2.38 5.03l -2.76 4.83l -2.96 4.71 z"/>
                <circle class="ff-centre-3" r="36" :style="cssProps"></circle>
            </svg>
        </transition>
        <v-snackbar class="text-center" v-model="snackbar" :timeout="5000">
            {{ snackbarText }}
            <!--            <template v-slot:action="{ attrs }">-->
            <!--                <v-btn-->
            <!--                    color="red"-->
            <!--                    text-->
            <!--                    v-bind="attrs"-->
            <!--                    @click="snackbar = false"-->
            <!--                >-->
            <!--                    Close-->
            <!--                </v-btn>-->
            <!--            </template>-->
        </v-snackbar>
    </div>
</template>

<script>
import audioService from "@/folkfriend/ff-audio";
import FFConfig from "@/folkfriend/ff-config";
import transcriber from "@/folkfriend/ff-transcriber.worker";

export default {
    name: "RecorderButton",
    computed: {
        cssProps() {
            return {
                '--primary-colour': this.$vuetify.theme.currentTheme.primary,
                '--secondary-colour': this.$vuetify.theme.currentTheme.secondary,
                '--recorder-circle-scale': this.recorderCircleScale,
            };
        }
    },
    data: () => {
        return {
            recording: null,
            working: null,
            transcriptionMode: null,
            transcriptionShortTimer: null,


            lastAudioVolume: 0,
            recorderCircleScale: null,

            snackbar: null,
            snackbarText: null,
        };
    },
    methods: {
        clicked: async function () {
            if (!this.recording) {
                await this.startRecording();
                this.$emit('recording-started');
            } else {
                await this.stopRecording();
            }
        },
        startRecording: async function () {
            if (this.recording) {
                return;
            }
            this.recording = true;

            this.lastAudioVolume = 0;
            this.updateRecorderCircleScale();

            try {
                // TODO nicely ask permission etc
                await audioService.startRecording()

                // Set timeout to auto stop recording
                this.transcriptionShortTimer = setTimeout(() => {
                    // So users can turn on transcription mode even if they
                    //  start in short query mode.
                    if (this.recording && !this.transcriptionMode) {
                        this.stopRecording();
                        this.snackbar = true;
                        this.snackbarText = 'Maximum duration reached';
                    }
                }, FFConfig.MAX_SHORT_QUERY_MS);

                // Begin fancy button animation
                let recB = this;
                const buttonAnimation = async function() {
                    recB.lastAudioVolume = await transcriber.getLastDCComponent();
                    recB.updateRecorderCircleScale();
                    if(recB.recording) {
                        window.requestAnimationFrame(buttonAnimation);
                    }
                }
                window.requestAnimationFrame(buttonAnimation);
            } catch (e) {
                console.error(e);
                alert(e);
                this.snackbar = true;
                this.snackbarText = "Couldn't open microphone";
                this.recording = false;
            }
        },
        stopRecording: async function () {
            if (!this.recording) {
                return;
            }
            this.recording = false;

            // Always set this, because even if we want to go straight back to
            //  the microphone (because no music was heard) we have to think
            //  a bit first and run through the CNN to determine that no music
            //  was heard.
            this.working = true;

            clearTimeout(this.transcriptionShortTimer);
            await audioService.stopRecording();
            this.$emit('recording-finished');
        },
        updateRecorderCircleScale: function() {
            // [0.8, 1.0]
            this.recorderCircleScale = 0.8 + Math.min(0.2, Math.max(0, 0.05 * this.lastAudioVolume));
        }
    }
};
</script>

<style scoped>

.RecorderButton {
    transition: filter ease-in-out 10ms;
    /*transition: filter ease-in-out 150ms;*/
}

.RecorderButton:hover {
    filter: brightness(0.9);
}

/* State transition animation */
/* See https://vuejs.org/v2/guide/transitions.html#Transitioning-Single-Elements-Components */
.fade-enter-active, .fade-leave-active {
    transition: opacity 150ms ease-in;
}

.fade-enter, .fade-leave-to {
    opacity: 0;
}

/* Recorder Button */

.RecorderButton, .WorkingGears {
    display: block;
    max-width: min(35vh, 35vw);
    user-select: none;

}

.RecorderMic {
    /*noinspection CssUnresolvedCustomProperty*/
    fill: var(--secondary-colour);
    opacity: 1;
    transition: opacity 250ms ease-in-out;
}

.RecorderCircle {
    /*noinspection CssUnresolvedCustomProperty*/
    stroke: var(--secondary-colour);
    fill: white;
    stroke-width: 1px;
    transition: fill 250ms ease-in-out, transform 200ms ease-out;
    transform-origin: 12px 12px;
    transform: scale(1.0);
}

.RecorderRect {
    fill: white;
    opacity: 0;
    transition: opacity 250ms ease-in-out;
}

.RecorderRect.RecorderActive {
    opacity: 1;
}

.RecorderMic.RecorderActive {
    opacity: 0;
}

.RecorderCircle.RecorderActive {
    fill: var(--secondary-colour);
    transform: scale(var(--recorder-circle-scale));
}

/* Working Gears */

/* Smallest */
.ff-gear-1 {
    animation: spin1 6s infinite linear reverse;
    transform-origin: 87px -257px;
}

.ff-centre-1 {
    transform: translate(87px, -257px);
}

/* Largest */
.ff-gear-2 {
    animation: spin2 10s infinite linear;
    transform-origin: -136px -34px;
}

.ff-centre-2 {
    transform: translate(-136px, -34px);
}

/* Medium */
.ff-gear-3 {
    animation: spin3 8s infinite linear reverse;
    transform-origin: 111px 213px;
}

.ff-centre-3 {
    transform: translate(111px, 213px);
}

.ff-gear-1, .ff-gear-2, .ff-gear-3, .ff-centre-1, .ff-centre-2, .ff-centre-3 {
    fill: #FFFFFFFF;
    stroke: var(--primary-colour);
    stroke-width: 16px;
    stroke-linejoin: round;
}

.ff-gear-1, .ff-gear-2, .ff-gear-3 {
    /*fill: var(--primary-colour);*/
    will-change: transform;
}

@keyframes spin1 {
    from {
        transform: rotate(0deg) translate(87px, -257px);
    }
    to {
        transform: rotate(360deg) translate(87px, -257px);
    }
}

@keyframes spin2 {
    from {
        transform: rotate(0deg) translate(-136px, -34px);
    }
    to {
        transform: rotate(360deg) translate(-136px, -34px);
    }
}

@keyframes spin3 {
    from {
        transform: rotate(0deg) translate(111px, 213px);
    }
    to {
        transform: rotate(360deg) translate(111px, 213px);
    }
}

</style>