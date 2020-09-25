// This is used on a worker thread, but is not a worker itself, because it is
//  always imported by the transcriber, which runs in a worker thread.

import FFConfig from "@/folkfriend/ff-config";

class ContourDecoder {
    constructor() {
        let lowBPM = 50;
        let highBPM = 300;

        this.tempos = [];
        for (let bpm = lowBPM; bpm <= highBPM; bpm += 5) {
            this.tempos.push(bpm);
        }
    }

    decode(contour) {

        let events = this._contourToEvents(contour);

        // Remove very short events or very dim events
        events = events.filter(e => e.power > 0.02 && e.duration > 4);

        // There may be no events left (all silence = all low power = all removed)
        //  or only very few. If there's only 3 or 4 notes we're really wasting
        //  everybody's time - let's just say there was no music heard.
        if (events.length <= 4) {
            return false;
        }

        let candidateDecodes = [];
        for (let i = 0; i < this.tempos.length; i++) {
            candidateDecodes.push(
                this.normaliseEventsByTempo(events, this.tempos[i])
            );
        }

        const bestCandidateDecode = candidateDecodes.reduce(
            (a, b) => a.score > b.score ? a : b);

        // Send back the result as a slightly more formal object
        return new DecodedAudio(
            bestCandidateDecode.decoded,
            bestCandidateDecode.tempo
        );
    }

    normaliseEventsByTempo(events, tempo) {
        // Simple algorithm to decode events to a queryable sequence, given a
        //   tempo in BPM.
        const fpq = this._BPMToNumFrames(tempo);
        const numInputFrames = events[events.length - 1].start + events[events.length - 1].duration;

        const output = [];
        let quantQuaverValues = [];
        let quantError = 0;

        events.forEach((e) => {

            // Simply choose nearest whole number of quavers.
            //   But be more lenient to giving each least one.
            const exactQuavers = e.duration / fpq;
            let quantQuavers;

            if (exactQuavers > 1. / 3) {
                quantQuavers = Math.max(1, Math.round(exactQuavers));
            } else {
                quantQuavers = 0;
            }

            // What is the quantisation error? Scale this by power
            //   so quantisation error is more important on stronger
            //   notes.
            quantQuaverValues.push(quantQuavers);
            output.push(...new Array(quantQuavers).fill(e.pitch));
            quantError += Math.abs(exactQuavers - quantQuavers) * e.power;
        });

        // We cannot rely on quantisation error alone. Clearly the optimal
        //   solution under this constraint is a tempo of one frame per
        //   quaver, so the error is always zero. This corresponds to a
        //   tempo of (crotchet) = 1406.25 which is utterly humanly
        //   impossible. Sane values are 50 - 300, with most tunes being
        //   played somewhere between 100 - 200. 300 BPM is incredibly fast,
        //   and 50 BPM is painfully slow.

        // We use a very simple model of how many notes we expect to see before
        //   the note changes (ie the distribution of values of quantError).
        // Note that this linear model is actually surprisingly close to reality,
        //  modelling the log likelihood which decreases logarithmically with a
        //  nearly constant exponent coefficient on length. (ie the number of
        //  occurrences of [1, 2, 3, 4, 5, 6, 7, 8] notes in the output file
        //  closely follows a single exponentially decreasing function. As we
        //  consider the output probability as the product of the individual
        //  probabilities the log likelihood is therefore roughly a sum of these
        //  notes
        let nzQuantQuaverValues = quantQuaverValues.filter(x => x > 0);

        if (!nzQuantQuaverValues.length) {
            return {decoded: [0], score: 0, tempo: 0};
        }

        let logLikelihoodApprox = nzQuantQuaverValues.map(x => 3 - 0.5 * x).reduce((a, b) => a + b);

        // Normalise by number of quantised quavers, otherwise there's a
        //   bias towards shorter tempos which have more positive scores.
        logLikelihoodApprox /= quantQuaverValues.length;

        // The quantisation error can be a maximum of num_frames * avg_power
        //   but we normalised power to 1 (although some events have been
        //   removed since then so the average power can be slightly greater).
        let quantScale = (1 - quantError / numInputFrames);

        // Overall error in tempo
        let totalFrameDelta = Math.abs(fpq * output.length - numInputFrames);
        let overallTimeError = 1 - totalFrameDelta / numInputFrames;

        // console.debug(quantScale, logLikelihoodApprox, overallTimeError);

        // Roughly, quant_scale belongs to [0, 1] so scales down the log
        //   likelihood if there's inaccuracy.
        let score = quantScale * logLikelihoodApprox * overallTimeError;

        return {decoded: output, score: score, tempo: tempo};
    }

    _contourToEvents(contour) {
        const pitches = contour.midis;
        const energies = contour.energies;

        let events = [];

        // We normalise the energies so the average power is 1
        let numEnergies = energies.length;
        let totalEnergy = energies.reduce((a, b) => a + b);

        if (totalEnergy === 0) {
            return [];
        }

        let energyNorm = numEnergies / totalEnergy;

        for (let i = 0; i < pitches.length; i++) {
            let pitch = pitches[i];
            let energy = energies[i];
            let lastEvent = events[events.length - 1];

            if (events.length && pitch === lastEvent.pitch) {
                // Increment duration
                lastEvent.duration += 1;

                // Cumulative energy sum
                lastEvent.energy += energy * energyNorm;

            } else {
                events.push({
                    start: i,
                    duration: 1,
                    pitch: pitch,
                    energy: energy * energyNorm,
                });
            }
        }

        for (let i = 0; i < events.length; i++) {
            // Average the energy over the duration. This is the power
            //  (energy / time). This is "dimensionless" because we
            //  scaled by energyNorm.
            events[i].power = events[i].energy / events[i].duration;
        }

        return events;
    }

    _BPMToNumFrames(bpm) {
        // Convert a BPM tempo into a float of frames per quaver
        let bps = bpm / 60;
        let quaversPS = bps * 2;  // Quaver = half a crotchet
        let framesPS = FFConfig.SAMPLE_RATE / FFConfig.SPEC_WINDOW_SIZE;
        return framesPS / quaversPS;  // Frames per quaver
    }
}

class DecodedAudio {
    // Simple wrapper for relevant variables at the end of a transcription
    constructor(decodedOutput, tempo) {
        this.midis = decodedOutput;
        this.tempo = tempo;
    }
}

const contourDecoder = new ContourDecoder();
export default contourDecoder;