<template>
    <v-container v-if="abc">
        <h1 class="my-2">
            Notes from audio
        </h1>
        <AbcDisplay :abc="abc" />
    </v-container>
    <v-container v-else-if="empty">
        <p class="px-10">
            Please record some music or upload an audio file to generate sheet
            music.
        </p>
    </v-container>
</template>

<script>
import AbcDisplay from '@/components/AbcDisplay';
import store from '@/services/store.js';
import ffBackend from '@/services/backend.js';

export default {
    name: 'TranscriptionsView',
    components: {
        AbcDisplay,
    },
    data: () => {
        return {
            abc: '',
            empty: true
        };
    },
    created: async function() {
        if (!store.state.lastContour) {
            return;
        }
        this.empty = false;

        let notes = await ffBackend.contourToAbc(store.state.lastContour);
        notes = notes.split(' ');
        let abc = '';
        let line = [];

        for (let i = 0; i < notes.length; i++) {
            if (line.length < 20 && i + 1 < notes.length) {
                line.push(notes[i]);
            } else {
                abc += line.join(' ') + '|\n';
                line = [];
            }
        }
        console.debug(abc);
        this.abc = abc;
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