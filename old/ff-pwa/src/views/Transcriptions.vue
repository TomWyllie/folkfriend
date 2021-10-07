<template>
    <v-container
        v-if="this.sharedState.lastTranscription"
        class="resultsTableWrapper mx-auto">
        <h2
            :style="`color:${this.$vuetify.theme.currentTheme.secondary};`"
        >Auto-transcribed ABC Data</h2>
        <AbcDisplay
            :abc="this.sharedState.lastTranscription.abc"
        ></AbcDisplay>
    </v-container>
    <v-container
        v-else>
        <p>No transcriptions loaded. Please record a tune.</p>
    </v-container>
</template>

<script>
import store from "@/services/store";
import AbcDisplay from "@/components/AbcDisplay";

export default {
    name: 'Transcriptions',
    components: {
        AbcDisplay,
    },
    data: function () {
        return {
            sharedState: store.state
        };
    },
};
</script>

<style scoped>
.resultsTableWrapper {
    display: block;
    max-width: min(90vh, 90vw);
}

.resultsTable div:nth-child(odd) {
    background: #EFEFEF;
}
</style>