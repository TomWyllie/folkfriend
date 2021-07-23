
import math
import copy

import numpy as np

from folkfriend import ff_config
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
    #   At each step of the algorithm, keep only the optimal route
    #   from the current frame to each pitch of the next frame.
    #   This is almost dynamic programming but isn't truly optimal
    #   because we score inconsistency based on temporal state, but
    #   this state-space isn't fully maintained.

    contours = []

    for pitch in range(num_midis):
        contour = Contour()
        contour.pitches = [pitch]
        contour.lengths = [1]
        contour.energy += spec[0, pitch]
        contours.append(contour)

    for frame in tqdm(range(1, num_frames)):
        
        next_contours = []
        
        # assert all((sum(c.lengths) == frame) for c in contours)

        for next_pitch in range(num_midis):

            next_contour = None
            next_contour_ind = None
            next_contour_score = -1 * math.inf

            for i, contour in enumerate(contours):
                # The additional energy of this frame / pitch is the same
                #   for all contours, so when comparing scores we don't
                #   need to take it into account. Just the effects of tempo.

                score = contour.score
                if contour.pitches[-1] != next_pitch:
                    score -= contour.inconsistency_single(contour.lengths[-1])

                if score >= next_contour_score:
                    next_contour_score = score
                    next_contour_ind = i

            # We don't actually *apply* the update to each contour in the
            #   previous step, just work out which one will have the highest
            #   (best) score. Now we apply the update,
            next_contour = copy.deepcopy(contours[next_contour_ind])

            next_contour.energy += spec[frame, next_pitch]

            if next_contour.pitches[-1] != next_pitch:

                next_contour.inconsistency += contour.inconsistency_single(
                    contour.lengths[-1])

                # Update states
                next_contour.lengths.append(1)
                next_contour.pitches.append(next_pitch)

            else:
                next_contour.lengths[-1] += 1

            next_contours.append(next_contour)

            # try:
            #     assert all((sum(c.lengths) == frame + 1) for c in next_contours)
            # except AssertionError as e:
            #     print(next_contours)
            #     print(frame + 1)
            #     raise e


        # print('next contours', len(next_contours))

        contours = next_contours

    best_contour = max(contours, key=lambda c: c.score)

    view_contour(best_contour)

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
        return self.energy - self.inconsistency

    # def inconsistency(self):
    #     return sum(self.inconsistency_single(f) for f in self.lengths)

    def inconsistency_single(self, frames_per_beat):
        return self.inconsistency_weight * abs(
            math.log(frames_per_beat / self.frames_per_beat))

    def __repr__(self):
        return (f'Pitches:\t{self.pitches}\n'
                f'Lengths:\t{self.lengths}\n'
                f'Energy:\t\t{self.energy}\n'
                f'Inconsistency:\t{self.inconsistency}\n')


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
