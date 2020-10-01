"""Viterbi like algorithm for extracting a MIDI contour smoothly from the
    CNN output. A simple implementation could use argmax, but is not very
    good. This can incorporate a basic language model of the tune too."""

import argparse
import csv
import os
import timeit

import imageio
import numpy as np
# noinspection PyUnresolvedReferences
from tqdm import tqdm


def main(dataset):
    slices_path = os.path.join(dataset, 'slices.csv')

    with open(slices_path) as f:
        slices = list(csv.DictReader(f))
        slice_paths = [s['path'] for s in slices]

    cum_proc_ms = 0
    avg_proc_ms = 0

    for i, audio_slice in tqdm(enumerate(slice_paths),
                               desc='Generating Contours'):

        slice_path = os.path.join(dataset, audio_slice)

        # Be sure to have run the wav conversion script.
        cnn_feat_path = slice_path.replace('.wav', '.png')

        uint8_denoised = imageio.imread(cnn_feat_path).T

        # In javascript these will be the activations straight from the CNN, which
        #   has a sigmoid at the end so [0, 1]
        denoised = np.asarray(uint8_denoised, dtype=np.float32)
        denoised /= np.max(denoised)

        sparse_denoised_frames = []

        for frame in denoised:
            sparse_denoised_frames.append(topk(frame))

        t0 = timeit.default_timer()
        viterbi_indices = beam_search(sparse_denoised_frames)
        cum_proc_ms += timeit.default_timer() - t0
        # noinspection PyUnusedLocal
        avg_proc_ms = 1000 * cum_proc_ms / (1 + i)
        # print('{:.3f}ms'.format(avg_proc_ms))

        base_path = os.path.basename(cnn_feat_path).replace('.png', '')
        imageio.imwrite(f'pngs/{base_path}-in.png', uint8_denoised.T)

        # View output contour for debugging
        debug_out = np.zeros_like(uint8_denoised)
        debug_out[np.arange(len(viterbi_indices)), viterbi_indices] = 255
        imageio.imwrite(f'pngs/{base_path}-out.png', debug_out.T)


def beam_search(sparse_frames, max_beams=5):

    # Initialise our beams with one on each of the first 10 midis
    #   that are encountered in sparse_frames
    initial_midis = set()

    for sf in sparse_frames:
        for midi in sf.keys():
            initial_midis.add(midi)
            if len(initial_midis) >= max_beams:
                break
        else:
            continue
        break

    initial_beam = Beam()

    beams = []
    for midi in initial_midis:
        # Some of the first 10 midis must have appeared in the first frame
        #  but many may have not. This is actually pretty important - we
        #  don't want to constrain the contour to always start on the first
        #  non-zero bin as there's a very good chance it's wrong - we have no
        #  information at this point.
        energy = sparse_frames[0].get(midi, 0)
        candidate = initial_beam.test_candidate(midi, energy)
        beams.append(Beam().apply_candidate(candidate))

    for sf in sparse_frames[1:]:

        candidates = []

        for next_midi, next_energy in sf.items():
            for beam in beams:
                candidate = beam.test_candidate(next_midi, next_energy)
                if candidate is not False:
                    candidates.append([beam, candidate])

        # Any midi in an existing beam is also feasible, for that beam.
        #   That is, any midi is allowed to continue on its current
        #   value, in addition to any of the non-zero midis at this frame.
        #   Other beams cannot transition to zero-energy midis of other beams.
        for beam in beams:
            if beam.previous_midi not in sf:
                # Can never be false because necessarily has not changed
                #   Energy is always zero - if it was non zero it would've
                #   been added in the loop above.
                candidate = beam.test_candidate(beam.previous_midi, 0)
                candidates.append([beam, candidate])

        # Remove redundant beams candidates, and keep N best beam candidates.
        #   Sort by score <desc>
        #   Any beam candidate A scored below any other beam candidate B, such
        #   that A and B have the same next_frame, but A changed more recently
        #   than B, can be discarded, as it represents a subset of the
        #   paths possibly traversed by B but is on a lower score, so can
        #   never be better than A.
        candidates = sorted(candidates, key=lambda c: c[1].score, reverse=True)
        original_num_candidates = len(candidates)
        non_redundant_bcs = 0
        redundant_bc_indices = []
        observed_midis = {}

        # print(original_num_candidates)

        for i in range(original_num_candidates):
            if non_redundant_bcs > max_beams:
                break

            cand: BeamCandidate = candidates[i][1]

            if cand.next_midi not in observed_midis:
                observed_midis[
                    cand.next_midi
                ] = cand.new_frames_since_last_change
                non_redundant_bcs += 1
                continue

            else:
                # fslc = frames since last change
                previous_high_fslc = observed_midis[cand.next_midi]

                this_cand_fslc = cand.new_frames_since_last_change

                # If this condition is true, then this candidate has equal
                #   or more restrictions then a previous one on the same note
                #   and has a lower score, so it's redundant. If it's not,
                #   then we save this_cand_fslc as an even higher bound for
                #   any other candidate also coming to this note to beat,
                #   making it increasingly unlikely that low scoring beam
                #   candidates are non-redundant on this note.
                if this_cand_fslc <= previous_high_fslc:
                    redundant_bc_indices.append(i)
                else:
                    # Upgrade the FSLC to an even higher value for this midi
                    observed_midis[
                        cand.next_midi
                    ] = cand.new_frames_since_last_change
                    non_redundant_bcs += 1
                    continue

        # Now remove the beam candidates determined to be redundant.
        #   Reversing is important or we break the index values!
        for redundant_bc_index in redundant_bc_indices[::-1]:
            candidates.pop(redundant_bc_index)

        # There may yet be many beams left, so only choose the top N.
        candidates = candidates[:max_beams]

        t1 = timeit.default_timer()

        # Finally apply save the surviving candidates as beams to use for the
        #   next frame.

        # copy.deepcopy is slow. This should be faster
        # beams = [copy.deepcopy(beam).apply_candidate(cand) for beam, cand in candidates]

        beams = []
        for beam, cand in candidates:
            new_b = Beam()
            new_b.cum_energy = cand.new_cum_energy
            new_b.cum_transition_prob = cand.new_cum_transition_prob
            new_b.num_changes = cand.new_num_changes
            new_b.contour = beam.contour.copy()
            new_b.contour.append(cand.next_midi)
            # Length after append
            new_b.last_change = len(new_b.contour) - cand.new_frames_since_last_change
            beams.append(new_b)

    # Now simply choose the best beam.
    return beams[0].contour


BEAM_MIN_EVENT_LENGTH = 5


class BeamCandidate:
    # The energy and transition_prob values are very different and are
    #   logarithmic in nature so we are adding them. We can't multiply or we
    #   could be combining low absolute values with negative values to achieve
    #   higher scores.
    ENERGY_VS_TRANSITION_WEIGHT = 100

    def __init__(self, next_midi, new_cum_energy, new_cum_transition_prob,
                 new_num_changes, new_length, has_changed,
                 new_frames_since_last_change):
        self.next_midi = next_midi
        self.has_changed = has_changed

        self.new_cum_energy = new_cum_energy
        self.new_cum_transition_prob = new_cum_transition_prob
        self.new_num_changes = new_num_changes

        self.new_frames_since_last_change = new_frames_since_last_change

        avg_energy = new_cum_energy / new_length

        if self.new_num_changes == 0:
            # Treat one note as a one tone up transition (ie the most likely)
            avg_transition_prob = score_transition_likelihood(0, 2)
        else:
            avg_transition_prob = self.new_cum_transition_prob / self.new_num_changes

        self.score = (BeamCandidate.ENERGY_VS_TRANSITION_WEIGHT * avg_energy
                      + avg_transition_prob)


class Beam:
    def __init__(self):
        self.contour = []
        self.cum_energy = 0
        self.cum_transition_prob = 0

        self.last_change = -BEAM_MIN_EVENT_LENGTH
        self.num_changes = 0

    @property
    def frames_since_last_change(self):
        return len(self.contour) - self.last_change

    @property
    def can_change(self):
        return self.frames_since_last_change >= BEAM_MIN_EVENT_LENGTH

    @property
    def previous_midi(self):
        return self.contour[-1]

    def test_candidate(self, next_midi, next_energy):
        # Propose that the next midi note on this contour could be next_midi.
        #   First we evaluate if that is possible, and if so then we score
        #   that candidate and return it.
        has_changed = len(self.contour) and next_midi != self.previous_midi

        if has_changed and not self.can_change:
            return False

        new_cum_energy = self.cum_energy + next_energy
        new_cum_transition_prob = self.cum_transition_prob
        new_num_changes = self.num_changes

        if has_changed:
            new_num_changes += 1
            new_cum_transition_prob -= score_transition_likelihood(
                self.previous_midi, next_midi
            )

        return BeamCandidate(
            next_midi=next_midi,
            new_cum_energy=new_cum_energy,
            new_cum_transition_prob=new_cum_transition_prob,
            new_num_changes=new_num_changes,
            new_length=1 + len(self.contour),
            has_changed=has_changed,
            new_frames_since_last_change=(1 if has_changed else
                                          1 + self.frames_since_last_change)
        )

    def apply_candidate(self, beam_candidate: BeamCandidate):
        if beam_candidate.has_changed:
            # Do this before appending.
            self.last_change = len(self.contour)
        self.contour.append(beam_candidate.next_midi)
        self.cum_energy = beam_candidate.new_cum_energy
        self.cum_transition_prob = beam_candidate.new_cum_transition_prob
        self.num_changes = beam_candidate.new_num_changes
        return self


def score_transition_likelihood(m1, m2):
    # Transition from m1 to m2.
    d = abs(m1 - m2)
    # TODO transition matrix as a proper model
    return 0.25 * d


def topk(inp, k=5):
    """This function isn't really necessary in python but we do it in
        javascript so do it here too so the inputs to the viterbi
        function are comparable"""

    # TODO an idea for an octave corrector - check if say >50% of max sparse
    #   bins occur with another an octave higher / lower and join these up
    #   and try merging the contours??

    indices = np.flip(np.argsort(inp))[:k]

    sparse = {indices[0]: inp[indices[0]]}
    for i in range(k):
        # Make sure any value we add is at least 10% of the maximum, and > 0.
        #  Otherwise we deem it to be meaningless.
        if inp[indices[i]] > 0 and inp[indices[i]] >= 0.1 * sparse[indices[0]]:
            sparse[indices[i]] = inp[indices[i]]
    return sparse


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', default='/home/tom/datasets/evaluation-tunes')
    args = parser.parse_args()
    main(args.dataset)
