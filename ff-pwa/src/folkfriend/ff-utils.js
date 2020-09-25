// Self-contained functions which come in handy throughout the project

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
    
    static midiToHertz(midi) {
        return 440 * Math.pow(2, (midi - 69) / 12)
    }

    static hertzToMidi(hertz) {
        return 69 + 12 * Math.log2(hertz / 440)
    }
}
