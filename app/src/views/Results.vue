<template>
    <v-container
        v-if="lastResults.length"
        class="resultsTableWrapper mx-auto px-0"
    >
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
        <p class="px-10">
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