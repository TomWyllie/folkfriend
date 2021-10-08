<template>
    <v-container class="resultsTableWrapper mx-auto">
        <v-list class="resultsTable">
            <!-- <ResultRow
                v-for="result in this.sharedState.lastSearch"
                :key="`${result.tune}#${result.setting}`"
                :result="result"
            ></ResultRow> -->
        </v-list>
    </v-container>
</template>

<script>
// import ResultRow from "@/components/ResultRow";

// export default {
//     name: 'Searches',
//     components: {
//         ResultRow,
//     },
//     data: function () {
//         return {
//             sharedState: store.state
//         };
//     },
// };
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