import FFConfig from "./ff-config";

export default class ABCConverter {
    constructor() {
        this.baseMap = {
            72: 'c',
            73: '^c',
            74: 'd',
            75: '^d',
            76: 'e',
            77: 'f',
            78: '^f',
            79: 'g',
            80: '^g',
            81: 'a',
            82: '^a',
            83: 'b',
        };

        this.abcMap = this.getAbcMap();
    }

    midiToAbc(midi) {
        let apos = 0;   // Apostrophes
        let commas = 0;

        while (midi >= 84) {
            apos += 1;
            midi -= 12;
        }

        while (midi <= 71) {
            commas += 1;
            midi += 12;
        }

        let base = this.baseMap[midi];

        if (commas >= 1) {
            base = base.toUpperCase();
            commas -= 1;
        }

        return base + ','.repeat(commas) + "'".repeat(apos);
    }

    decodedToAbc(decoded) {

        let hold = 0;
        let lastN = null;
        let out = [];

        decoded.forEach(n => {
            if (n === lastN) {
                hold += 1;
                return;
            } else if (hold) {
                out.push((hold + 1).toString());
                hold = 0;
            }
            out.push(` ${this.abcMap[n]}`);
            lastN = n;
        });

        return out.join("");
    }

    getAbcMap() {
        const abcMap = {};
        for (let i = 0; i < FFConfig.MIDI_NUM; i++) {
            abcMap[i] = this.midiToAbc(FFConfig.MIDI_LOW + i);
        }
        return abcMap;
    }
}
