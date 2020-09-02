/* Viterbi like algorithm for extracting a MIDI contour smoothly from the
    CNN output. A simple implementation could use argmax, but is not very
    good. This can incorporate a basic language model of the tune too."""
*/

function contourBeamSearch(sparse_frames, max_beams = 5) {

    // Initialise our beams with one on each of the first 10 midis
    //   that are encountered in sparse_frames
    const initial_midis = new Set();

    // Lol WTF who knew you could label for loops in native JS.
    //  https://stackoverflow.com/questions/183161/whats-the-best-way-to-break-from-nested-loops-in-javascript
    //  Not me that's for sure.
    outerLoop: for (const sf of sparse_frames) {
        for (const midi of Object.keys(sf)) {
            initial_midis.add(parseInt(midi));
            if (initial_midis.length >= max_beams) {
                break outerLoop;
            }
        }
    }

    const initial_beam = new Beam();

    let beams = [];
    for (const midi of initial_midis) {
        // Some of the first 10 midis must have appeared in the first frame
        //  but many may have not. This is actually pretty important - we
        //  don't want to constrain the contour to always start on the first
        //  non-zero bin as there's a very good chance it's wrong - we have no
        //  information at this point.
        const energy = sparse_frames[0][midi] || 0;
        const candidate = initial_beam.test_candidate(midi, energy);
        beams.push(new Beam().apply_candidate(candidate));
    }

    for (const sf of sparse_frames.slice(1)) {

        let candidates = [];

        for (const [next_midi, next_energy] of Object.entries(sf)) {
            for (const beam of beams) {
                const candidate = beam.test_candidate(parseInt(next_midi), next_energy);
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
            if (!sf.hasOwnProperty(beam.previous_midi)) {
                // Can never be false because necessarily has not changed
                //   Energy is always zero - if it was non zero it would've
                //   been added in the loop above.
                let candidate = beam.test_candidate(beam.previous_midi, 0);
                candidates.push([beam, candidate]);
            }
        }

        // Remove redundant beams candidates, and keep N best beam candidates.
        //   Sort by score <desc>
        //   Any beam candidate A scored below any other beam candidate B, such
        //   that A and B have the same next_frame, but A changed more recently
        //   than B, can be discarded, as it represents a subset of the
        //   paths possibly traversed by B but is on a lower score, so can
        //   never be better than A.
        candidates = candidates.sort((a, b) => a[1].score < b[1].score ? 1 : -1);
        let original_num_candidates = candidates.length;
        let non_redundant_bcs = 0;
        let redundant_bc_indices = [];
        let observed_midis = {};

        for (const i of Array(original_num_candidates).keys()) {
            if (non_redundant_bcs > max_beams) {
                break;
            }

            const cand = candidates[i][1];

            if (!observed_midis.hasOwnProperty(cand.next_midi)) {
                observed_midis[
                    cand.next_midi
                    ] = cand.new_frames_since_last_change;
                non_redundant_bcs += 1;
            } else {
                // fslc = frames since last change
                const previous_high_fslc = observed_midis[cand.next_midi];

                const this_cand_fslc = cand.new_frames_since_last_change;

                // If this condition is true, then this candidate has
                //   more restrictions than a previous one on the same note
                //   and has a lower score, so it's redundant. If it's not,
                //   then we save this_cand_fslc as an even higher bound for
                //   any other candidate also coming to this note to beat,
                //   making it increasingly unlikely that low scoring beam
                //   candidates are non-redundant on this note.
                if (this_cand_fslc <= previous_high_fslc) {
                    redundant_bc_indices.push(i);
                } else {
                    // Upgrade the FSLC to an even higher value for this midi
                    observed_midis[
                        cand.next_midi
                        ] = cand.new_frames_since_last_change;
                    non_redundant_bcs += 1;
                }
            }
        }

        // Now remove the beam candidates determined to be redundant.
        //   Reversing is important or we break the index values!
        for (const redundant_bc_index of redundant_bc_indices.reverse()) {
            candidates.splice(redundant_bc_index);
        }

        // There may yet be many beams left, so only choose the top N.
        candidates = candidates.slice(0, max_beams);

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
    for(const [i, m] of contourMidis.entries()) {
        // Zero energy bins may well be on the optimal path
        contourEnergies.push(sparse_frames[i][m] || 0);
    }

    return {
        midis: contourMidis,
        energies: contourEnergies
    }
}


BEAM_MIN_EVENT_LENGTH = 5;


class BeamCandidate {
    // The energy and transition_prob values are very different and are
    //   logarithmic in nature so we are adding them. We can't multiply or we
    //   could be combining low absolute values with negative values to achieve
    //   higher scores.
    static ENERGY_VS_TRANSITION_WEIGHT = 0.02;

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
            avg_transition_prob = score_transition_likelihood(0, 2);
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
            new_cum_transition_prob += score_transition_likelihood(
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


function score_transition_likelihood(m1, m2) {
    // Transition from m1 to m2.
    const d = Math.abs(m1 - m2);
    // TODO transition matrix as a proper model
    return -0.25 * d;
}
