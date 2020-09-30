<template>
    <v-card elevation="0">
        <v-container class="ma-0 pa-0">
            <span class="abcTextView mx-auto">{{ this.abcText }}</span>
        </v-container>
        <div></div>
    </v-card>
</template>

<script>
/* eslint-disable */

import abcjs from "abcjs";

export default {
    name: "AbcDisplay",
    mounted: async function () {
        const svgDiv = this.$el.lastChild;
        abcjs.renderAbc(svgDiv, this.abcText, {responsive: 'resize'});
    },
    computed: {
        abcText: function () {
            const abcLines = [];
            if (this.mode) {
                abcLines.push(`K:${this.mode}`);
            }
            if (this.meter) {
                abcLines.push(`M:${this.meter}`);
            }
            abcLines.push(this.abc);
            return abcLines.join('\n');
        }
    },
    props: {
        abc: {
            type: String,
        },
        mode: {
            type: String,
        },
        meter: {
            type: String,
        },
    }
};
</script>

<style scoped>
.abcTextView {
    font-family: Courier,serif;
    white-space: pre-wrap;
    display: inline-block;
}
</style>