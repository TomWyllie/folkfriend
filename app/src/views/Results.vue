<template>
    <v-container
        v-if="lastResults.length"
        class="viewContainerWrapper"
    >
        <h1 class="my-2">
            Results
        </h1>
        <v-list class="resultsTable">
            <ResultRow
                v-for="result in lastResults"
                :key="`${result.setting.tune_id}`"
                :setting="result.setting"
                :display-name="result.display_name"
                :setting-i-d="result.setting_id"
                :score="result.score"
            />
        </v-list>
    </v-container>
    <v-container v-else>
        <h1 class="my-2">
            Results
        </h1>
        <p>
            Please record some music or upload an audio file to search the tune database.
        </p>
    </v-container>
</template>

<script>
import ResultRow from '@/components/ResultRow';
import store from '@/services/store';

export default {
    name: 'SearchesView',
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