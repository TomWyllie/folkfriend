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
                <v-col class="mx-5 pt-5 pb-0" sm="6" md="8">
                    <v-text-field
                        label="Search By Tune Name"
                        outlined
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

        <!-- <v-container class="py-0 mx-auto">
            <v-row wrap align="center" justify="center" class="mx-0">
                <v-col align="center" class="noFlexGrow px-5">
                    <v-btn v-on:click="uploadDemo" :disabled="!offlineButton">
                        Demo
                    </v-btn>
                </v-col>
            </v-row>
        </v-container> -->

        <!-- <v-container class="tuneProgress">
            <v-progress-linear
                v-show="progressBar"
                v-model="featureProgress"
                :buffer-value="progressSearching ? 0 : audioProgress"
                :indeterminate="progressSearching"
            ></v-progress-linear>
        </v-container> -->

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

            icons: {
                magnify: mdiMagnify,
                timerOutline: mdiTimerOutline,
                timerOffOutline: mdiTimerOffOutline,
            },
        };
    },
    methods: {
        nameQuery() {
            ffBackend.runNameQuery(this.textQuery).then((results) => {
                store.state.lastResults = results;
                this.$router.push({ name: "results" });
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
        }
    },
};
</script>

<style scoped>
.tuneProgress {
    max-width: 60%;
}

.noFlexGrow {
    flex-grow: 0;
}
</style>
