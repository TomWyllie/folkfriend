<template>
    <v-container>
        <h1>Settings</h1>
        <h3>TODO Select microphone</h3>
        <h3>TODO Select performance settings</h3>

        <v-container class="mx-auto px-5">
            <v-row>
                <v-switch
                    inset
                    v-model="userSettings.preferFileUpload"
                    @change="settingsChanged"
                    label="Upload file instead of using device microphone"
                    class="my-0"
                >
                </v-switch>
            </v-row>
            <v-row>
                <v-switch
                    inset
                    v-model="userSettings.advancedMode"
                    @change="settingsChanged"
                    label="Removes time limit on microphone and generates sheet music without searching database"
                    class="my-0"
                >
                </v-switch>
            </v-row>
            <v-row>
                <v-switch
                    inset
                    v-model="userSettings.showAbcText"
                    @change="settingsChanged"
                    label="Show ABC as text alongside sheet music"
                    class="my-0"
                ></v-switch>
            </v-row>
        </v-container>
    </v-container>
</template>

<script>
import store from "@/services/store.js";
import eventBus from "@/eventBus";

export default {
    name: "Settings",
    data: () => ({
        settingsLoaded: false,
        userSettings: store.userSettings,
    }),
    created: function () {
        eventBus.$emit("parentViewActivated");
    },
    methods: {
        settingsChanged() {
            store.updateUserSettings(this.userSettings);
        }
    },
};
</script>

<style scoped>
</style>