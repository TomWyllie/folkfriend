<template>
    <v-container class="resultsTableWrapper mx-auto">
        <v-list class="resultsTable">
            <ResultRow
                v-for="result in this.lastResults"
                :key="`${result.setting.tune_id}`"
                :result="result"
            ></ResultRow>
        </v-list>
    </v-container>
</template>

<script>
import ResultRow from "@/components/ResultRow";
import store from "@/services/store";

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

.resultsTable div:nth-child(odd) {
    background: #efefef;
}
</style>