
import math
import copy
import collections

import numpy as np

from folkfriend import ff_config
from folkfriend.decoder import tempo_model
from folkfriend.decoder import pitch_model
import matplotlib.pyplot as plt

from timeit import default_timer as dt

from tqdm import tqdm


def decode(spec):
    """Decode spectral features to a contour of notes."""

    start = dt()

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
        c_new = Contour()
        c_new.pitches = [pitch]
        c_new.lengths = [1]
        c_new.energy += spec[0, pitch]
        contours.append(c_new)

    Proposal = collections.namedtuple('Proposal', ['contour', 'next_pitch'])

    # for frame in tqdm(range(1, num_frames)):
    for frame in range(1, num_frames):

        # print(f'== Analysing frame {frame} of decoder, with {len(contours)} '
        #       'current contours ==')

        # =======================
        # === Draft proposals ===
        # =======================

        proposals = set()

        # Add all non-zero-energy pitches to the proposals.
        for next_pitch in range(num_midis):
            if spec[frame, next_pitch] == 0:
                continue

            for i, c_new in enumerate(contours):
                proposals.add(Proposal(i, next_pitch))

        # Add the possibility of staying on the same pitch, for each contour
        for i, c_new in enumerate(contours):
            proposals.add(Proposal(i, c_new.pitches[-1]))

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
            
            # This is > 2x faster the deepcopy.copy
            c_old = contours[contour_id]
            c_new = Contour()
            c_new.pitches[:] = c_old.pitches[:]
            c_new.lengths[:] = c_old.lengths[:]
            c_new.energy = c_old.energy
            c_new.tempo_cost = c_old.tempo_cost
            c_new.pitch_cost = c_old.pitch_cost
            c_new.score_next_pitch(next_pitch, reward, update=True)
            
            new_contours.append(c_new)

        contours = new_contours

    best_contour = max(contours, key=lambda c: c.score)

    # view_contour(best_contour)
    # print(f'Decoded in {dt() - start} secs')
    
    expanded_counter = expand_contour(best_contour)
    query = contour_to_query(best_contour)

    return query, expanded_counter

def contour_to_query(contour):
    lengths = (l / contour.frames_per_beat for l in contour.lengths)
    lengths = (round(l) for l in lengths)
    lengths = ((l if l > 0 else 1) for l in lengths)    

    query = []

    for length, pitch in zip(lengths, contour.pitches):
        correct_pitch = ff_config.MIDI_LOW - 1 + (ff_config.MIDI_NUM - pitch)
        query.extend([correct_pitch] * length)

    return query


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
        self.tempo_cost = 0.
        self.pitch_cost = 0.
        self.frames_per_beat = 8       # ~ 100 BPM

    @property
    def bpm(self):
        return frames_to_bpm(self.frames_per_beat)

    @property
    def score(self):
        return self.energy - self.tempo_cost - self.pitch_cost

    def score_next_pitch(self, pitch, reward, update):
        """Compute score that would result from going to next_pitch next."""

        energy = self.energy
        inconsistency = self.tempo_cost
        pitch_cost = self.tempo_cost

        interval = pitch - self.pitches[-1]
        is_note_change = interval != 0

        # If this is a note change, we must apply tempo penalty.
        if is_note_change:
            inconsistency += tempo_model.score_note_length(
                self.lengths[-1], self.frames_per_beat)

            pitch_cost += pitch_model.score_pitch_interval(interval)

        # Add energy 'reward' of new pitch.
        energy += reward

        if update is True:
            self.energy = energy
            self.tempo_cost = inconsistency
            self.pitch_cost = pitch_cost

            if is_note_change:
                self.pitches.append(pitch)
                self.lengths.append(1)
            else:
                self.lengths[-1] += 1

        score = energy - inconsistency - pitch_cost
        return score, is_note_change

    def __repr__(self):
        return (f'Pitches:\t{self.pitches}\n'
                f'Lengths:\t{self.lengths}\n'
                f'Energy:\t\t{self.energy}\n'
                f'Inconsistency:\t{self.tempo_cost}\n\n')


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
