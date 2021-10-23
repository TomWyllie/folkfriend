<template>
    <v-container>
        <h1>Help</h1>
        <h1>Donate</h1>
        <h3>spiel</h3>
        <h1>About</h1>
        <h3>FolkFriend App Version: {{ frontendVersion }}</h3>
        <h3>FolkFriend Backend version: {{ backendVersion }}</h3>
        <h3>© 2021 Tom Wyllie. All Rights Reserved.</h3>
    </v-container>
</template>

<script>
import store from "@/services/store.js";
import ffConfig from "@/ffConfig.js";

export default {
    name: "Help",
    computed: {
        backendVersion() {
            return store.state.backendVersion;
        },
        frontendVersion() {
            return ffConfig.FRONTEND_VERSION;
        },
    },
};
</script>

<style scoped>
</style>