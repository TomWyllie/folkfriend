class ABCConverter {
    constructor() {
        this.base_map = {
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
        }

        this.abc_map = this.get_abc_map()
    }

    midi_to_abc(midi) {
        let apos = 0;   // Apostrophes
        let commas = 0;

        while(midi >= 84) {
            apos += 1;
            midi -= 12;
        }

        while(midi <= 71) {
            commas += 1;
            midi += 12;
        }

        let base = this.base_map[midi];

        if(commas >= 1) {
            base = base.toUpperCase();
            commas -= 1;
        }

        return base + ','.repeat(commas) + "'".repeat(apos);
    }

    decoded_to_abc(decoded) {

        let hold = 0;
        let last_n = null;
        let out = [];

        decoded.forEach(n => {
            if (n === last_n) {
                hold += 1;
                return;
            } else if (hold) {
                out.push((hold + 1).toString());
                hold = 0;
            }
            out.push(` ${this.abc_map[n]}`);
            last_n = n;
        });
        console.debug(out);

        return out.join("");
    }

    get_abc_map() {
        const ABC_MAP = {};
        for(let i = 0; i < FFConfig.MIDI_NUM; i++) {
            ABC_MAP[i] = this.midi_to_abc(FFConfig.MIDI_HIGH - i);
        }
        return ABC_MAP;
    }
}

