<template>
    <div class="search">
        <RecorderButton
            class="mx-auto my-xl-5 pt-5"
            ref="recorderButton"
            @clickFileUpload="$refs.fileUpload.click()"
        />
        <input
            ref="fileUpload"
            type="file"
            id="audio-upload"
            accept="audio/*"
            style="display: none"
            @change="audioFileChanged"
        />

        <v-container>
            <v-row wrap justify="center">
                <v-col class="mx-5 pt-8 pb-0" sm="6" md="8">
                    <v-text-field
                        label="Search By Tune Name"
                        solo
                        v-model="textQuery"
                        @keypress.enter="nameQuery"
                    >
                        <template v-slot:append>
                            <v-icon @click="nameQuery">{{
                                icons.magnify
                            }}</v-icon>
                        </template>
                    </v-text-field>
                </v-col>
            </v-row>
        </v-container>

        <v-container class="tuneProgress">
            <v-progress-linear
                v-bind:class="{ Transparent: indexLoaded }"
                indeterminate
                rounded
            ></v-progress-linear>
        </v-container>

        <v-snackbar class="text-center" v-model="snackbar" :timeout="3000">
            {{ snackbarText }}
        </v-snackbar>
    </div>
</template>

<script>
import RecorderButton from "@/components/RecorderButton";
import ffBackend from "@/services/backend";
import audioService from "@/services/audio";
import store from "@/services/store";
import eventBus from "@/eventBus";

import { mdiMagnify, mdiTimerOutline, mdiTimerOffOutline } from "@mdi/js";

export default {
    name: "Search",
    components: {
        RecorderButton,
    },
    data: function () {
        return {
            snackbar: null,
            snackbarText: null,

            textQuery: "",
            offlineButton: true,
            indexLoaded: store.state.indexLoaded,

            icons: {
                magnify: mdiMagnify,
                timerOutline: mdiTimerOutline,
                timerOffOutline: mdiTimerOffOutline,
            },
        };
    },
    created: function () {
        eventBus.$emit("parentViewActivated");

        if(!this.indexLoaded) {
            eventBus.$on("indexLoaded", () => {
                this.indexLoaded = true;
            });
        }
    },
    methods: {
        nameQuery() {
            if(this.textQuery.length < 2) {
                this.snackbar = true;
                this.snackbarText = "Search query too short";
                return;
            }

            ffBackend.runNameQuery(this.textQuery).then((results) => {
                store.state.lastResults = results;
                this.$router.push({ name: "results" });
                eventBus.$emit("childViewActivated");
            });
        },
        placeholderMethod() {
            console.debug("placeholder action");
        },
        advancedMode(mode) {
            store.userSettings.advancedMode = mode;
        },
        async audioFileChanged(e) {
            store.setSearchState(store.searchStates.WORKING);

            console.time("file-upload");
            const file = e.target.files[0];
            const url = URL.createObjectURL(file);
            const audioData = await audioService.urlToTimeDomainData(url);
            console.timeEnd("file-upload");

            console.time("feed-pcm-signal");
            await ffBackend.feedEntirePCMSignal(audioData);
            console.timeEnd("feed-pcm-signal");

            await ffBackend.submitFilledBuffer();
            store.setSearchState(store.searchStates.READY);
        },
    },
};
</script>

<style scoped>
.tuneProgress {
    max-width: 50%;
    opacity: 1;
}

.Transparent {
    opacity: 0;
}

.noFlexGrow {
    flex-grow: 0;
}
</style>
