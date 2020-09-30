<template>
    <v-list>
        <ResultRow
            v-for="result in this.$route.params.results"
            :key="result.setting"
            :result="result"
        ></ResultRow>
        <!--<p>{{ this.$route.query }}</p>-->
    </v-list>
</template>

<script>
import ResultRow from "@/components/ResultRow";

export default {
    name: "Searches",
    components: {
        ResultRow,
    },
    props: {
        results: {
            type: Array
        }
    }
};
</script>

<style scoped>

</style>