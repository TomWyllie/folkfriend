// Self-contained functions which come in handy throughout the project

// https://grammar.yourdictionary.com/capitalization/rules-for-capitalization-in-titles.html
const LOWER_TITLE_WORDS = new Set(["a", "an", "the", "at", "by", "for", "in", "of", "on", "to", "up", "and", "as", "but", "or", "nor"]);

// Wrap in a class for ease of exports
export default class utils {
    static daysSince2020() {
        const unixMs = Date.now();
        const unixS = Math.round(unixMs / 1000);

        // 1577836800 = 2020-01-01T00:00:00+00:00 in ISO 8601
        const secsSince2020 = unixS - 1577836800;
        const daysSince2020 = Math.floor(secsSince2020 / (24 * 3600));

        // NO time travelling >:c
        return Math.max(0, daysSince2020);
    }

    static parseDisplayableName(rawName, casing=true) {
        // https://bitbucket.org/Tom_Wyllie/folk-friend-web-app/src/master/app/js/folkfriend-app.js
        if (rawName.endsWith(', The')) {
            rawName = 'The ' + rawName.slice(0, -5);
        }

        if(!casing) {
            return rawName;
        }

        let words = rawName.split(" ");

        // Ensure small words are not capitalised, unless they are at the start of the word
        for (let [i, word] of words.entries()) {
            if (i === 0) continue;    // First word is always capitalised
            if (LOWER_TITLE_WORDS.has(word.toLowerCase())) {
                words[i] = word.toLowerCase();
            }
        }
        return words.join(" ");
    }

    static parseDisplayableDescription(setting) {
        return `${setting.type} in ${setting.mode.slice(0, 4)}`;
    }

    static parseQueryableString(s) {
        return s.toLowerCase();
    }

    static midiToHertz(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12);
    }

    static hertzToMidi(hertz) {
        return 69 + 12 * Math.log2(hertz / 440);
    }

    static renderImageForDebug(typedArrays) {
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

    static lerpColor(a, b, amount) {
        a = a.replace('#', '0x');
        b = b.replace('#', '0x');

        // https://gist.github.com/nikolas/b0cce2261f1382159b507dd492e1ceef
        const ar = a >> 16,
            ag = a >> 8 & 0xff,
            ab = a & 0xff,

            br = b >> 16,
            bg = b >> 8 & 0xff,
            bb = b & 0xff,

            rr = ar + amount * (br - ar),
            rg = ag + amount * (bg - ag),
            rb = ab + amount * (bb - ab);

        return `rgb(${Math.round(rr)}, ${Math.round(rg)}, ${Math.round(rb)})`;
    }
}
