<template>
    <v-container>
        <h1>Settings</h1>
        <!-- TODO have this version match package.json automagically? -->
        <h3>TODO Select microphone</h3>
        <h3>TODO Test microphone</h3>
        <h3>TODO Select performance settings (high / medium / low)</h3>
        <h3>Test FolkFriend performance</h3>

        <v-switch inset @change="showAbcText" label="Show ABC Text"></v-switch>

        <h1>About</h1>
        <!-- TODO have this version match package.json automagically? -->
        <h3>FolkFriend App Version: {{ frontendVersion }}</h3>
        <h3>FolkFriend Backend version: {{ backendVersion }}</h3>
        <h3>© 2021 Tom Wyllie. All Rights Reserved.</h3>

        <h1>Donate</h1>
        <h3>spiel</h3>
    </v-container>
</template>

<script>
import store from "@/services/store.js";
import ffConfig from "@/ffConfig.js";

export default {
    name: "Settings",
    computed: {
        backendVersion() {
            return store.state.backendVersion;
        },
        frontendVersion() {
            return ffConfig.FRONTEND_VERSION;
        },
    },
    methods: {
        showAbcText(value) {
            // TODO better handling of settings and things
            store.userSettings.showAbcText = value;
        },
    },
};
</script>

<style scoped>
</style>