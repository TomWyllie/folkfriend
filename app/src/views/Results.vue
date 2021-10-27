<template>
    <v-container v-if="lastResults.length" class="resultsTableWrapper mx-auto px-0">
        <v-list class="resultsTable">
            <ResultRow
                v-for="result in this.lastResults"
                :key="`${result.setting.tune_id}`"
                :result="result"
            ></ResultRow>
        </v-list>
    </v-container>
    <v-container v-else>
        <p class="px-10">Please record some music or upload an audio file to search the tune database.</p>
    </v-container>
</template>

<script>
import ResultRow from "@/components/ResultRow";
import store from "@/services/store";
import eventBus from "@/eventBus.js";

export default {
    name: 'Searches',
    components: {
        ResultRow,
    },
    data: function () {
        return {
            lastResults: store.state.lastResults
        };
    },
};
</script>

<style scoped>
.resultsTableWrapper {
    display: block;
    max-width: min(90vh, 90vw);
}

.resultsTable > a:nth-child(odd) {
    background: #efefef;
}

</style>