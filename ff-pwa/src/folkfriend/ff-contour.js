/* Viterbi like algorithm for extracting a MIDI contour smoothly from the
    CNN output. A simple implementation could use argmax, but is not very
    good. This can incorporate a basic language model of the tune too."""
*/

// Log likelihoods of intervals based on thesession.org dataset
//  Interval 0 (same note) is excluded because it's not a transition
const TRANSITION_LIKELIHOODS = {
    "-12": -4.862729914,
    "-11": -6.616962671,
    "-10": -5.195117404,
    "-9": -4.389511542,
    "-8": -4.529393252,
    "-7": -3.385424236,
    "-6": -5.954093232,
    "-5": -2.853697858,
    "-4": -2.898438133,
    "-3": -2.61756944,
    "-2": -2.462423203,
    "-1": -3.598778811,
    "1": -3.523344336,
    "2": -2.222813183,
    "3": -2.558428021,
    "4": -2.819645063,
    "5": -2.527086002,
    "6": -5.272730177,
    "7": -3.444736763,
    "8": -4.710698161,
    "9": -4.995631992,
    "10": -5.795059625,
    "11": -7.371974346,
    "12": -5.636881433,
};
const BEAM_MIN_EVENT_LENGTH = 5;

class ContourExtractor {
    constructor() {

    }

    // Async purely because it's been workerfied by comlink
    async contourFromFeatures(typedArrays) {

        const sparseFeatureFrames = [];
        for(const featureFrame of typedArrays) {
            // Reverse is in place
            featureFrame.reverse();
            sparseFeatureFrames.push(topK(featureFrame, 4));
            featureFrame.reverse();
        }

        return contourBeamSearch(sparseFeatureFrames);

    }
}

function contourBeamSearch(sparseFrames, maxBeams = 5) {

    // Initialise our beams with one on each of the first 10 midis
    //   that are encountered in sparse_frames
    const initialMidis = new Set();

    // Lol WTF who knew you could label for loops in native JS.
    //  https://stackoverflow.com/questions/183161/whats-the-best-way-to-break-from-nested-loops-in-javascript
    //  Not me that's for sure.
    outerLoop: for (const sf of sparseFrames) {
        for (const midi of Object.keys(sf)) {
            initialMidis.add(parseInt(midi));
            if (initialMidis.length >= maxBeams) {
                break outerLoop;
            }
        }
    }

    const initial_beam = new Beam();

    let beams = [];
    for (const midi of initialMidis) {
        // Some of the first 10 midis must have appeared in the first frame
        //  but many may have not. This is actually pretty important - we
        //  don't want to constrain the contour to always start on the first
        //  non-zero bin as there's a very good chance it's wrong - we have no
        //  information at this point.
        const energy = sparseFrames[0][midi] || 0;
        const candidate = initial_beam.test_candidate(midi, energy);
        beams.push(new Beam().apply_candidate(candidate));
    }

    for (const sf of sparseFrames.slice(1)) {

        let candidates = [];

        for (const [nextMidi, nextEnergy] of Object.entries(sf)) {
            for (const beam of beams) {
                const candidate = beam.test_candidate(parseInt(nextMidi), nextEnergy);
                if (candidate !== false) {
                    candidates.push([beam, candidate]);
                }
            }
        }

        // Any midi in an existing beam is also feasible, for that beam.
        //   That is, any midi is allowed to continue on its current
        //   value, in addition to any of the non-zero midis at this frame.
        //   Other beams cannot transition to zero-energy midis of other beams.
        for (const beam of beams) {
            if (!Object.prototype.hasOwnProperty.call(sf, beam.previous_midi)) {
                // Can never be false because necessarily has not changed
                //   Energy is always zero - if it was non zero it would've
                //   been added in the loop above.
                let candidate = beam.test_candidate(beam.previous_midi, 0);
                candidates.push([beam, candidate]);
            }
        }

        // BC = beam candidate
        // Remove redundant beams candidates, and keep N best beam candidates.
        //   Sort by score <desc>
        //   Any beam candidate A scored below any other beam candidate B, such
        //   that A and B have the same next_frame, but A changed more recently
        //   than B, can be discarded, as it represents a subset of the
        //   paths possibly traversed by B but is on a lower score, so can
        //   never be better than A.
        candidates = candidates.sort((a, b) => a[1].score < b[1].score ? 1 : -1);
        let originalNumCandidates = candidates.length;
        let nonRedundantBCs = 0;
        let redundantBCIndices = [];
        let observedMidis = {};

        for (const i of Array(originalNumCandidates).keys()) {
            if (nonRedundantBCs > maxBeams) {
                break;
            }

            const cand = candidates[i][1];

            if (!Object.prototype.hasOwnProperty.call(observedMidis, cand.next_midi)) {
                observedMidis[
                    cand.next_midi
                    ] = cand.new_frames_since_last_change;
                nonRedundantBCs += 1;
            } else {
                // fslc = frames since last change
                const previous_high_fslc = observedMidis[cand.next_midi];

                const this_cand_fslc = cand.new_frames_since_last_change;

                // If this condition is true, then this candidate has equal
                //   or more restrictions then a previous one on the same note
                //   and has a lower score, so it's redundant. If it's not,
                //   then we save this_cand_fslc as an even higher bound for
                //   any other candidate also coming to this note to beat,
                //   making it increasingly unlikely that low scoring beam
                //   candidates are non-redundant on this note.
                if (this_cand_fslc <= previous_high_fslc) {
                    redundantBCIndices.push(i);
                } else {
                    // Upgrade the FSLC to an even higher value for this midi
                    observedMidis[
                        cand.next_midi
                        ] = cand.new_frames_since_last_change;
                    nonRedundantBCs += 1;
                }
            }
        }

        // Now remove the beam candidates determined to be redundant.
        //   Reversing is important or we break the index values!
        for (const redundant_bc_index of redundantBCIndices.reverse()) {
            candidates.splice(redundant_bc_index);
        }

        // There may yet be many beams left, so only choose the top N.
        candidates = candidates.slice(0, maxBeams);

        // Finally apply save the surviving candidates as beams to use for the
        //   next frame.
        beams = [];
        for (const [beam, cand] of candidates) {
            const new_b = new Beam();
            new_b.cum_energy = cand.new_cum_energy;
            new_b.cum_transition_prob = cand.new_cum_transition_prob;
            new_b.num_changes = cand.new_num_changes;
            new_b.contour = beam.contour.slice(0);
            new_b.contour.push(parseInt(cand.next_midi));
            // Length after append
            new_b.last_change = new_b.contour.length - cand.new_frames_since_last_change;
            beams.push(new_b);
        }
    }

    // Now simply choose the best beam.
    const contourMidis = beams[0].contour;

    // Knowing which midi notes correspond to high energy is still useful later
    //  when selecting the tempo so we extract the relevant energy and return
    //  that too.
    const contourEnergies = [];
    for (const [i, m] of contourMidis.entries()) {
        // Zero energy bins may well be on the optimal path
        contourEnergies.push(sparseFrames[i][m] || 0);
    }

    return {
        midis: contourMidis,
        energies: contourEnergies
    };
}

function scoreTransitionLikelihood(m1, m2) {
    // Transition from m1 to m2.
    const d = String(m2 - m1);

    //  Anything more than an octave assigned score -10
    return TRANSITION_LIKELIHOODS[d] || -10;
}

function topK(inp, count=4) {
    let indices = [];
    for (let i = 0; i < inp.length; i++) {
        indices.push(i); // add index to output array
        if (indices.length > count) {
            indices.sort(function (a, b) {
                return inp[b] - inp[a];
            }); // descending sort the output array
            indices.pop(); // remove the last index (index of smallest element in output array)
        }
    }
    let sparse = {};
    sparse[indices[0]] = inp[indices[0]];
    for (let i = 1; i < count; i++) {
        // Make sure any value we add is at least 5% of the maximum.
        //  Otherwise we deem it to be meaningless.
        if (inp[indices[i]] >= 0.1 * sparse[indices[0]]) {
            sparse[indices[i]] = inp[indices[i]];
        }
    }
    return sparse;
}

class BeamCandidate {
    // The energy and transition_prob values are very different and are
    //   logarithmic in nature so we are adding them. We can't multiply or we
    //   could be combining low absolute values with negative values to achieve
    //   higher scores.
    static ENERGY_VS_TRANSITION_WEIGHT = 130.0;

    constructor(next_midi, new_cum_energy, new_cum_transition_prob,
                new_num_changes, new_length, has_changed,
                new_frames_since_last_change) {
        this.next_midi = next_midi;
        this.has_changed = has_changed;

        this.new_cum_energy = new_cum_energy;
        this.new_cum_transition_prob = new_cum_transition_prob;
        this.new_num_changes = new_num_changes;

        this.new_frames_since_last_change = new_frames_since_last_change;

        const avg_energy = new_cum_energy / new_length;

        let avg_transition_prob;
        if (this.new_num_changes === 0) {
            // Treat one note as a one tone up transition (ie the most likely)
            avg_transition_prob = scoreTransitionLikelihood(0, 2);
        } else {
            avg_transition_prob = this.new_cum_transition_prob / this.new_num_changes;
        }

        this.score = (BeamCandidate.ENERGY_VS_TRANSITION_WEIGHT * avg_energy
            + avg_transition_prob);
    }
}

class Beam {
    constructor() {
        this.contour = [];
        this.cum_energy = 0;
        this.cum_transition_prob = 0;

        this.last_change = -BEAM_MIN_EVENT_LENGTH;
        this.num_changes = 0;
    }

    get frames_since_last_change() {
        return this.contour.length - this.last_change;
    }

    get can_change() {
        return this.frames_since_last_change >= BEAM_MIN_EVENT_LENGTH;
    }

    get previous_midi() {
        return this.contour[this.contour.length - 1];
    }

    test_candidate(next_midi, next_energy) {
        // Propose that the next midi note on this contour could be next_midi.
        //   First we evaluate if that is possible, and if so then we score
        //   that candidate and return it.
        const has_changed = this.contour.length && next_midi !== this.previous_midi;

        if (has_changed && !this.can_change) {
            return false;
        }

        const new_cum_energy = this.cum_energy + next_energy;
        let new_cum_transition_prob = this.cum_transition_prob;
        let new_num_changes = this.num_changes;

        if (has_changed) {
            new_num_changes += 1;
            new_cum_transition_prob += scoreTransitionLikelihood(
                this.previous_midi, next_midi
            );
        }

        return new BeamCandidate(
            next_midi,
            new_cum_energy,
            new_cum_transition_prob,
            new_num_changes,
            1 + this.contour.length,
            has_changed,
            has_changed ? 1 : 1 + this.frames_since_last_change
        );
    }

    apply_candidate(beam_candidate) {
        if (beam_candidate.has_changed) {
            // Do this before appending.
            this.last_change = this.contour.length;
        }
        this.contour.push(parseInt(beam_candidate.next_midi));
        this.cum_energy = beam_candidate.new_cum_energy;
        this.cum_transition_prob = beam_candidate.new_cum_transition_prob;
        this.num_changes = beam_candidate.new_num_changes;
        return this;
    }
}

const contourExtractor = new ContourExtractor();
export default contourExtractor;