<template>
    <div class="home">

        <!--suppress CssInvalidFunction, CssInvalidPropertyValue -->
        <HelloWorld/>

        <button v-on:click="startRecording">Start Recording</button>
        <button v-on:click="stopRecording">Stop Recording</button>
        <button v-on:click="demo">Demo from .WAV file</button>
        <span class="block">Performance: {{ this.$data.postProcPerf }} ms</span>
        <ul id="results">
            <li v-for="item in this.$data.tunesTable" v-bind:key="item.setting">
                {{ item.name }}
            </li>
        </ul>
    </div>
</template>

<script>
import HelloWorld from "@/components/HelloWorld.vue";

import audioService from "@/folkfriend/ff-audio";
import transcriber from "@/folkfriend/ff-transcriber.worker";
import queryEngine from "@/folkfriend/ff-query-engine";
import ds from "../services/database.worker";

export default {
    name: 'Home',
    components: {
        HelloWorld
    },
    mounted: function () {
        console.debug('Home loaded');
    },
    data() {
        return {
            tunesTable: [],
            postProcPerf: 0
        };
    },
    methods: {
        demo: async function () {
            const t0 = Date.now();

            const timeDomainDataQueue = await audioService.urlToTimeDomainData('audio/fiddle.wav');
            const decoded = await transcriber.transcribeTimeDomainData(timeDomainDataQueue);
            console.debug(decoded);

            if (!decoded) {
                console.warn('No music decoded');
                return;
            }

            const result = await queryEngine.query(decoded.midis);
            console.debug(result);

            let tunes = await ds.tunesFromQueryResults(result);
            console.debug(tunes);

            this.$data.postProcPerf = Math.round(Date.now() - t0);
            this.$data.tunesTable = tunes.slice(0, 10);
        },

        startRecording: async function () {
            await audioService.startRecording();
        },
        stopRecording: async function () {
            const t0 = Date.now();

            console.debug('Audio stopping');
            await audioService.stopRecording();
            console.debug('Audio stopped');

            const decoded = await transcriber.gatherAndDecode();
            // this.renderImageForDebug(decoded);
            console.debug(decoded);

            if (!decoded) {
                console.warn('No music decoded');
                return;
            }

            const result = await queryEngine.query(decoded.midis);
            console.debug(result);

            let tunes = await ds.tunesFromQueryResults(result);
            console.debug(tunes);

            this.$data.postProcPerf = Math.round(Date.now() - t0);
            this.$data.tunesTable = tunes.slice(0, 10);
        },

        renderImageForDebug: function (typedArrays) {
            console.debug(typedArrays);

            const w = typedArrays.length;
            const h = typedArrays[0].length;
            const scale = 1;

            const canvas = document.createElement('canvas');
            canvas.setAttribute("style", "zoom: 2; image-rendering: pixelated;");
            canvas.width = scale * w;
            canvas.height = scale * h;

            const ctx = canvas.getContext('2d');
            ctx.scale(scale, scale);
            const imageData = ctx.createImageData(w, h);

            const max = Math.max(...typedArrays.map(x => Math.max(...x)).filter(x => isFinite(x)));
            const min = Math.min(...typedArrays.map(x => Math.min(...x)).filter(x => isFinite(x)));
            const range = max - min;

            // Iterate through every pixel
            for (let x = 0; x < w; x++) {
                for (let y = 0; y < h; y++) {
                    const i = 4 * (y * w + x);
                    const v = Math.round(255 * (typedArrays[x][y] - min) / range);
                    imageData.data[i] = v;          // R value
                    imageData.data[i + 1] = v;      // G value
                    imageData.data[i + 2] = v;      // B value
                    imageData.data[i + 3] = 255;    // A value
                }
            }

            // Draw image data to the canvas
            ctx.putImageData(imageData, 0, 0);

            document.body.appendChild(canvas);
        }
    }
};


</script>

<style scoped>

.block {
    display: block;
}

/* Smallest */
#ff-gear-1 {
    animation: spin1 6s infinite linear reverse;
    transform-origin: 87px -257px;
}

#ff-centre-1 {
    transform: translate(87px, -257px);
}

/* Largest */
#ff-gear-2 {
    animation: spin2 10s infinite linear;
    transform-origin: -136px -34px;
}

#ff-centre-2 {
    transform: translate(-136px, -34px);
}

/* Medium */
#ff-gear-3 {
    animation: spin3 8s infinite linear reverse;
    transform-origin: 111px 213px;
}

#ff-centre-3 {
    transform: translate(111px, 213px);
}

#ff-gear-1, #ff-gear-2, #ff-gear-3, circle {
    fill: none;
    stroke: black;
    stroke-width: 10px;
    stroke-linejoin: round;
    will-change: transform;
}

@keyframes spin1 {
    from {
        transform: rotate(0deg) translate(87px, -257px);
    }
    to {
        transform: rotate(360deg) translate(87px, -257px);
    }
}

@keyframes spin2 {
    from {
        transform: rotate(0deg) translate(-136px, -34px);
    }
    to {
        transform: rotate(360deg) translate(-136px, -34px);
    }
}

@keyframes spin3 {
    from {
        transform: rotate(0deg) translate(111px, 213px);
    }
    to {
        transform: rotate(360deg) translate(111px, 213px);
    }
}

</style>
