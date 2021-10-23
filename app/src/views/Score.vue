<template>
    <v-container v-if="abc">
        <h1
            class="my-2"
            :style="`color:${this.$vuetify.theme.currentTheme.secondary};`"
        >
            Transcribed Notes
        </h1>
        <AbcDisplay :abc="abc"></AbcDisplay>
    </v-container>
    <v-container v-else>
        <p class="px-10">Please record some music or upload an audio file to generate sheet music.</p>
    </v-container>
</template>

<script>
import AbcDisplay from "@/components/AbcDisplay";
import store from "@/services/store.js";

export default {
    name: "Transcriptions",
    components: {
        AbcDisplay,
    },
    computed: {
        abc() {
            if (!store.state.lastNotes.length) {
                return;
            }

            let notes = store.state.lastNotes.split(" ");
            let abc = "";
            let line = [];

            for (let i = 0; i < notes.length; i++) {
                if (line.length < 20 && i + 1 < notes.length) {
                    line.push(notes[i]);
                } else {
                    abc += line.join(" ") + "\n";
                    line = [];
                }
            }
            return abc;
        },
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