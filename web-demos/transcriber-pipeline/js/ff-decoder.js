class Decoder {
    constructor() {
        let lowBPM = 50;
        let highBPM = 300;

        this.tempos = [];
        for(let bpm = lowBPM; bpm <= highBPM; bpm += 5) {
            this.tempos.push(bpm);
        }
    }
    
    decode(pitches, energies) {
        if(pitches.length === 0) {
            // TODO improve
            this.output = {};
        }

        let events = this.pitches_to_events(pitches, energies);

        // Remove very short events or very dim events
        events = events.filter(e => e.power > 0.02 && e.duration > 4);

        let candidateDecodes = [];
        for(let i = 0; i < this.tempos.length; i++) {
            candidateDecodes.push(
                this.normalise_events_by_tempo(events, this.tempos[i])
            );

            // console.debug(candidateDecodes[candidateDecodes.length - 1].score);
        }

        const bestCandidate = candidateDecodes.reduce(
            (a, b) => a.score > b.score ? a : b);

        return bestCandidate;
    }

    normalise_events_by_tempo(events, tempo) {

        // Simple algorithm to decode events to a queryable sequence, given a
        //   tempo in BPM.
        const fpq = this.bpm_to_num_frames(tempo);
        const input_num_frames = events[events.length - 1].start + events[events.length - 1].duration;

        const output_query = [];
        let quant_quaver_values = [];
        let quant_error = 0;

        events.forEach((e) => {

            // Simply choose nearest whole number of quavers.
            //   But be more lenient to giving each least one.
            const exact_quavers = e.duration / fpq;
            let quant_quavers;

            if (exact_quavers > 1. / 3) {
                quant_quavers = Math.max(1, Math.round(exact_quavers));
            } else{
                quant_quavers = 0;
            }

            // What is the quantisation error? Scale this by power
            //   so quantisation error is more important on stronger
            //   notes.
            quant_quaver_values.push(quant_quavers);
            output_query.push(...new Array(quant_quavers).fill(e.pitch));
            quant_error += Math.abs(exact_quavers - quant_quavers) * e.power;
        });

        // We cannot rely on quantisation error alone. Clearly the optimal
        //   solution under this constraint is a tempo of one frame per
        //   quaver, so the error is always zero. This corresponds to a
        //   tempo of (crotchet) = 1406.25 which is utterly humanly
        //   impossible. Sane values are 50 - 300, with most tunes being
        //   played somewhere between 100 - 200. 300 BPM is incredibly fast,
        //   and 50 BPM is painfully slow.

        // We use a very simple model of how many notes we expect to see before
        //   the note changes (ie the distribution of values of quant_error).
        let nz_quant_quaver_values = quant_quaver_values.filter(x => x > 0);
        let log_likelihood_approx = nz_quant_quaver_values.map(x => 3 - 0.5 * x).reduce((a, b) => a + b);

        // Normalise by number of quantised quavers, otherwise there's a
        //   bias towards shorter tempos which have more positive scores.
        log_likelihood_approx /= quant_quaver_values.length;

        // The quantisation error can be a maximum of num_frames * avg_power
        //   but we normalised power to 1 (although some events have been
        //   removed since then so the average power can be slightly greater).
        let quant_scale = (1 - quant_error / input_num_frames);

        // Overall error in tempo
        let total_frame_delta = Math.abs(fpq * output_query.length - input_num_frames);
        let overall_time_error = 1 - total_frame_delta / input_num_frames;

        console.debug(quant_scale, log_likelihood_approx, overall_time_error);

        // Roughly, quant_scale belongs to [0, 1] so scales down the log
        //   likelihood if there's inaccuracy.
        let score = quant_scale * log_likelihood_approx * overall_time_error;

        return {decoded: output_query, score: score, tempo: tempo};
    }

    pitches_to_events(pitches, energies){
        console.debug(pitches);
        console.debug(energies);

        let events = [];

        // We normalise the energies so the average power is 1
        let num_energies = energies.length;
        let total_energy = energies.reduce((a, b) => a+ b);

        if(total_energy === 0) {
            return [];
        }

        let energy_norm = num_energies / total_energy;

        for(let i = 0; i < pitches.length; i++) {
            let pitch = pitches[i];
            let energy = energies[i];
            let lastEvent = events[events.length - 1];

            if(events.length && pitch === lastEvent.pitch) {
                // Increment duration
                lastEvent.duration += 1;

                // Cumulative energy sum
                lastEvent.energy += energy * energy_norm;

            } else {
                events.push({
                    start: i,
                    duration: 1,
                    pitch: pitch,
                    energy: energy * energy_norm,
                });
            }
        }

        for(let i = 0; i < events.length; i++) {
            // Average the energy over the duration. This is the power
            //  (energy / time). This is "dimensionless" because we
            //  scaled by energy_norm.
            events[i].power = events[i].energy / events[i].duration;
        }

        console.debug(events);

        return events;
    }

    bpm_to_num_frames(bpm){
        // Convert a BPM tempo into a float of frames per quaver
        let bps = bpm / 60;
        let quavers_ps = bps * 2;  // Quaver = half a crotchet
        let frames_ps = FFConfig.SAMPLE_RATE / FFConfig.SPEC_WINDOW_SIZE;
        return frames_ps / quavers_ps;  // Frame per quaver
    }
}
