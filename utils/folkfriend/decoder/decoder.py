
import math
import copy
import collections

import numpy as np

from folkfriend import ff_config
from folkfriend.decoder import tempo_model
import matplotlib.pyplot as plt

from tqdm import tqdm


def decode(spec):
    """Decode spectral features to a contour of notes."""

    # spec = spec[:50]
    num_frames, num_midis = spec.shape
    assert num_midis == ff_config.MIDI_NUM

    # Normalise energy to average 1.0 AU per frame

    spec *= (num_frames / np.sum(spec))

    # Start one contour off on each possible pitch.
    #   At each step of the algorithm, propose all possible next states, for
    #   each of the N current contours.
    #   Score each proposal, and determine the top N proposals.
    #   Apply the proposals to update N current contours to N next contours

    contours = []

    for pitch in range(num_midis):
        contour = Contour()
        contour.pitches = [pitch]
        contour.lengths = [1]
        contour.energy += spec[0, pitch]
        contours.append(contour)

    Proposal = collections.namedtuple('Proposal', ['contour', 'next_pitch'])

    for frame in tqdm(range(1, num_frames)):

        # print(f'== Analysing frame {frame} of decoder, with {len(contours)} '
        #       'current contours ==')

        # =======================
        # === Draft proposals ===
        # =======================

        proposals = set()

        # assert all((sum(c.lengths) == frame) for c in contours)

        # Add all non-zero-energy pitches to the proposals.
        for next_pitch in range(num_midis):
            if spec[frame, next_pitch] == 0:
                continue

            for i, contour in enumerate(contours):
                proposals.add(Proposal(i, next_pitch))

        # Add the possibility of staying on the same pitch, for each contour
        for i, contour in enumerate(contours):
            proposals.add(Proposal(i, contour.pitches[-1]))

        # print(f'{len(proposals)} proposals drafted')

        # =======================
        # === Score proposals ===
        # =======================

        scored_proposals = {}

        for proposal in proposals:
            contour_id, next_pitch = proposal
            
            assert type(contour_id) is int
            assert type(next_pitch) is int
            
            reward = spec[frame, next_pitch]    # Energy payoff of changing
            
            score, is_change = contours[contour_id].score_next_pitch(
                next_pitch, reward, update=False)
            
            scored_proposals[proposal] = (score, is_change)

        # print(f'{len(scored_proposals)} proposals scored')

        # ========================
        # === Dedupe proposals ===
        # ========================

        # If two proposals are on the same bin, and changed note at the same
        #   time, then choose the one with the higher score. This 'pruning' of
        #   paths that can never be optimal is the key to dynamic programming.

        # This is equivalent to pruning contours that change to the same pitch
        #   at the same time.

        # Indicing is pitch, length
        deduping = {}
        deduped_scored_proposals = []

        for proposal, (score, is_change) in scored_proposals.items():
            # Carry over contours that didn't change pitch (can't be ruled out)
            if not is_change:
                deduped_scored_proposals.append((score, proposal))
            
            else:
                _, next_pitch = proposal
                assert type(next_pitch) is int
                existing_score, _ = deduping.get(next_pitch, (-math.inf, None))

                # Retain only the best of contours that just changed
                if score > existing_score:
                    deduping[next_pitch] = (score, proposal)

        # Carry over the best of the contours that just changed pitch
        deduped_scored_proposals.extend(deduping.values())

        # print(f'{len(deduped_scored_proposals)} '
        #       'proposals remain after deduping')

        keep_n_proposals = 10
        best_proposals = sorted(deduped_scored_proposals,
                                key=lambda x: x[0], reverse=True)

        best_proposals = best_proposals[:keep_n_proposals]

        new_contours = []

        for _, proposal in best_proposals:
            contour_id, next_pitch = proposal
            reward = spec[frame, next_pitch]    # Energy payoff of changing
            
            contour = copy.deepcopy(contours[contour_id])
            contour.score_next_pitch(next_pitch, reward, update=True)
            
            new_contours.append(contour)

        contours = new_contours

    best_contour = max(contours, key=lambda c: c.score)

    # view_contour(best_contour)

    return expand_contour(best_contour)


def expand_contour(contour):
    pitches = []

    for pitch, length in zip(contour.pitches, contour.lengths):
        pitches.extend([pitch] * length)

    spec = np.zeros((len(pitches), ff_config.MIDI_NUM))
    indices = np.arange(len(pitches))
    spec[indices, pitches] = 1

    return spec


def view_contour(contour):
    spec = expand_contour(contour)
    plt.imshow(spec.T, cmap='gray')
    plt.show()


class Contour:
    def __init__(self) -> None:
        self.pitches = []
        self.lengths = []
        self.energy = 0.
        self.inconsistency = 0.
        self.inconsistency_weight = 0.1
        self.frames_per_beat = 10       # ~ 100 BPM

    @property
    def bpm(self):
        return frames_to_bpm(self.frames_per_beat)

    @property
    def score(self):
        return self.energy - self.inconsistency_weight * self.inconsistency

    def score_next_pitch(self, pitch, reward, update):
        """Compute score that would result from going to next_pitch next."""

        energy = self.energy
        inconsistency = self.inconsistency

        is_note_change = pitch != self.pitches[-1]

        # If this is a note change, we must apply tempo penalty.
        if is_note_change:
            inconsistency += tempo_model.score_note_length(
                self.lengths[-1], self.frames_per_beat)

        # Add energy 'reward' of new pitch.
        energy += reward

        if update is True:
            self.energy = energy
            self.inconsistency = inconsistency

            if is_note_change:
                self.pitches.append(pitch)
                self.lengths.append(1)
            else:
                self.lengths[-1] += 1

        score = energy - self.inconsistency_weight * inconsistency
        return score, is_note_change

    def __repr__(self):
        return (f'Pitches:\t{self.pitches}\n'
                f'Lengths:\t{self.lengths}\n'
                f'Energy:\t\t{self.energy}\n'
                f'Inconsistency:\t{self.inconsistency}\n\n')


def frames_to_bpm(frames_per_beat):
    """Convert length (in frames) of one beat to beats per minute"""
    seconds_per_frame = ff_config.SPEC_WINDOW_SIZE / ff_config.SAMPLE_RATE
    seconds_per_beat = seconds_per_frame * frames_per_beat
    beats_per_minute = 60 / seconds_per_beat

    # Assume that the length in frames is actually one quaver.
    #   We would normally quote BPM as (crotchet) = ... BPM, hence factor 2.
    beats_per_minute /= 2

    return beats_per_minute


if __name__ == '__main__':
    print([frames_to_bpm(i) for i in range(5, 20)])
