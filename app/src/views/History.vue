<template>
    <v-container>
        <h1>History</h1>
        <span>Coming soon</span>
    </v-container>
</template>

<script>
import eventBus from "@/eventBus";

export default {
    name: "History",
    created: function () {
        eventBus.$emit("parentViewActivated");
    },
};
</script>

<style scoped>
</style>