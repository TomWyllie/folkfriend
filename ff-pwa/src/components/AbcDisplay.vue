<template>
    <v-card>
        <p>{{ this.abc }}</p>
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
        abcjs.renderAbc(svgDiv, this.abc, {});

        // TODO there is responsive sizing in the library
        //  use that
        //  https://configurator.abcjs.net/visual

        // FolkFriend v1
        // https://bitbucket.org/Tom_Wyllie/folk-friend-web-app/src/master/app/js/folkfriend-app.js

        // // TODO on iOS this sheetMusicWrapper element has been null sometimes..?
        // let sheetMusicWrapper = document.getElementById(this.abcSVG);
        // let sheetMusicSvg = sheetMusicWrapper.firstChild;
        //
        // let svgWidth = sheetMusicSvg.width.baseVal.value;
        // let svgHeight = sheetMusicSvg.height.baseVal.value;
        //
        // // Get rid of the unflexible auto created dimensions / scaling code from the ABCJS library
        // sheetMusicSvg.removeAttribute('height');
        // sheetMusicSvg.removeAttribute('width');
        // sheetMusicWrapper.removeAttribute('style');
        //
        // sheetMusicSvg.setAttribute('style', 'max-width: 80%; max-height: 70%; display: block; margin: auto;');
        //
        // // There's a race condition between applying the viewbox and drawing the SVG on the page,
        // //  hence this delay here.
        // setTimeout(() => {
        //     let viewBoxString = '0 0 ' + svgWidth.toFixed(1) + ' ' + svgHeight.toFixed(1);
        //     sheetMusicSvg.setAttribute('viewBox', viewBoxString);
        // }, 20);
    },
    props: {
        abc: {
            type: String,
        },
    }
};
</script>

<style scoped>

</style>