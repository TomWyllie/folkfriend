<template></template>

<script>
import AbcDisplay from "@/components/AbcDisplay";

export default {
    name: "Transcriptions",
    components: {
        AbcDisplay,
    },
    data: function () {
        return {};
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