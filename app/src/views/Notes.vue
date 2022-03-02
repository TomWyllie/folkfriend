<template>
    <v-container 
        v-if="abc" 
        class="viewContainerWrapper"
    >
        <h1 class="my-2">
            Notes from audio
        </h1>
        <AbcDisplay :abc="abc" />
    </v-container>
    <v-container v-else-if="empty">
        <h1 class="my-2">
            Notes from audio
        </h1>
        <p>
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
        this.abc = await ffBackend.contourToAbc(store.state.lastContour);
        console.debug(this.abc);
    },
};
</script>

<style scoped>
.resultsTable div:nth-child(odd) {
    background: #efefef;
}
</style>