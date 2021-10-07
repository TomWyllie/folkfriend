
import math
import copy
import collections

import numpy as np

from folkfriend import ff_config
from folkfriend.decoder import tempo_model
from folkfriend.decoder import pitch_model

from timeit import default_timer as dt

from pprint import pprint
from tqdm import tqdm

# Only required states for tracking are
#   - prev_proposal_id : The index of the previous proposal
#   - pitch            : The pitch of this proposal
#   - score            : The score up to and including this proposal
#   - duration         : How many frames since the pitch changed
#  (- pitch_changed    : Has the pitch changed here - for optimisation only)
state_fields = ['prev_proposal_id', 'pitch',
                'score', 'duration', 'pitch_changed']
Proposal = collections.namedtuple('Proposal', state_fields)


def decode(spec):
    """Decode spectral features to a contour of notes."""

    tempos = [8]
    best_contours_by_tempo = []

    for tempo in tempos:
        decoder = Decoder(note_length_scale=tempo)
        best_contours_by_tempo.append(decoder.decode(spec, tempo))

    best_contour, _ = max(best_contours_by_tempo, key=lambda c: c[1])

    return best_contour


class Decoder():
    def __init__(self, note_length_scale=8) -> None:
        self.note_length_scale = note_length_scale
        self._tempo_score_cache = {}

    def _get_tempo_score(self, n):
        """Get the score for a note of n frames"""
        return self._tempo_score_cache.setdefault(
            n, tempo_model.score_note_length(n, self.note_length_scale)
        )

    def decode(self, spec, tempo):
        """For a fixed tempo, decode spectral features"""

        num_frames, num_midis = spec.shape
        assert num_midis == ff_config.MIDI_NUM

        # Normalise energy to average 1.0 AU per frame

        spec *= (num_frames / np.sum(spec))

        # Start one contour off on each possible pitch.
        #   At each step of the algorithm, propose all possible next states, for
        #   each of the N current contours.
        #   Score each proposal, and determine the top N proposals.
        #   Apply the proposals to update N current contours to N next contours

        # List of frames; each frame is a list of proposals at that frame
        proposals = [[]]

        for pitch in range(num_midis):
            proposals[0].append(Proposal(0, pitch, spec[0, pitch], 1, True))

        for frame in range(1, num_frames):
            # for frame in tqdm(range(1, num_frames)):

            # print(
            #     f'== Analysing frame {frame} of decoder, '
            #     f'with {len(proposals[frame - 1])} '
            #     'current proposals ==')

            # =====================================
            # === Draft and score new proposals ===
            # =====================================

            # start = dt()

            proposals.append([])
            pitches = {p for p in np.nonzero(spec[frame])[0]}

            for i, prev_prop in enumerate(proposals[frame - 1]):
                tempo_score = self._get_tempo_score(prev_prop.duration)
                for pitch in pitches | {prev_prop.pitch}:
                    # Add all non-zero-energy pitches as possible transitions,
                    #   as well as possibility of continuing on current pitch.
                    proposal = self.compute_new_proposal(
                        prev_proposal=prev_prop,
                        prev_proposal_id=i,
                        pitch=pitch,
                        energy=spec[frame, pitch],
                        tempo_score=tempo_score
                    )
                    proposals[frame].append(proposal)

            # print(f'{len(proposals[frame])} proposals drafted and scored')

            # print('drafting + scoring', num_frames * 1000 * (dt() - start))
            
            # ========================
            # === Dedupe proposals ===
            # ========================

            # If two proposals are on the same pitch, and changed note at the same
            #   time, then choose the one with the higher score. This 'pruning' of
            #   paths that can never be optimal is the key to dynamic programming.

            # This is equivalent to pruning proposals that change to the same pitch
            #   at the same time.

            proposal_ids_to_keep = []
            best_transitions = {}

            for i, proposal in enumerate(proposals[frame]):
                # Carry over contours that didn't change pitch (can't be ruled out)
                if not proposal.pitch_changed:
                    proposal_ids_to_keep.append(i)

                else:
                    existing_score, _ = best_transitions.get(
                        proposal.pitch, (-math.inf, None))

                    # Retain only the best of contours that just changed
                    if proposal.score > existing_score:
                        best_transitions[proposal.pitch] = (proposal.score, i)

            # Carry over the best of the contours that just changed pitch
            best_transition_ids = [p[1] for p in best_transitions.values()]
            proposal_ids_to_keep.extend(best_transition_ids)

            # print(f'{len(proposal_ids_to_keep)} '
            #       'proposals remain after deduping')

            best_proposals = sorted(
                proposal_ids_to_keep,
                key=lambda i: proposals[frame][i].score,
                reverse=True)[:ff_config.BEAM_WIDTH]

            best_proposals = [proposals[frame][i] for i in best_proposals]
            proposals[frame] = best_proposals

            # print('deduping', num_frames * 1000 * (dt() - start))

            # print(f'{len(proposals[frame])} '
            #       f'proposals computed for frame {frame}')

        # ===============================
        # === Retrace through lattice ===
        # ===============================

        best_final_proposal = max(proposals[-1], key=lambda p: p.score)
        contour_proposals = [best_final_proposal]

        for frame in range(num_frames-2, -1, -1):
            prev_prop = proposals[frame][contour_proposals[0].prev_proposal_id]
            contour_proposals.insert(0, prev_prop)

        contour = [p.pitch for p in contour_proposals]

        return contour, best_final_proposal.score

    def compute_new_proposal(self, prev_proposal: Proposal,
                             prev_proposal_id, pitch, energy, tempo_score):
        """Compute a proposal at time t given the proposal and proposal id at time
            t-1, the pitch at time t, and the spectral energy at that pitch and 
            time."""

        new_score = prev_proposal.score
        new_score += energy

        interval = pitch - prev_proposal.pitch
        pitch_changed = interval != 0

        if pitch_changed:
            # This is the seem for each value of the inner loop that calls this
            #   function. This is a performance optimisation.
            new_score += tempo_score
            new_score += pitch_model.score_pitch_interval(interval)
            duration = 1
        else:
            duration = prev_proposal.duration + 1

        return Proposal(prev_proposal_id, pitch, new_score,
                        duration, pitch_changed)


def contour_to_midi_seq(contour):
    if len(contour) == 0:
        return []

    pitches = []
    durations = []

    prev_pitch = contour[0]
    prev_dur = 1

    for pitch in contour:
        if pitch == prev_pitch:
            prev_dur += 1
        else:
            pitches.append(prev_pitch)
            durations.append(prev_dur)
            prev_pitch = pitch
            prev_dur = 1

    # TODO investigate different length scales
    durations = (d / ff_config.TEMPO_LENGTH_SCALE for d in durations)
    durations = (round(d) for d in durations)
    durations = ((d if d > 0 else 1) for d in durations)

    midi_seq = []

    for duration, pitch in zip(durations, pitches):
        midi_pitch = ff_config.MIDI_LOW + (ff_config.MIDI_NUM - 1 - pitch)
        midi_seq.extend([midi_pitch] * duration)

    return midi_seq


def midi_seq_to_query(midi_seq):
    return ''.join(
        ff_config.MIDI_MAP_[n - ff_config.MIDI_LOW] for n in midi_seq)

# def contour_to_query(contour):
#     # TODO move to query submodule
#     lengths = (l / contour.frames_per_beat for l in contour.lengths)
#     lengths = (round(l) for l in lengths)
#     lengths = ((l if l > 0 else 1) for l in lengths)

#     query = []

#     for length, pitch in zip(lengths, contour.pitches):
#         correct_pitch = ff_config.MIDI_NUM - 1 - pitch
#         query.extend([correct_pitch] * length)

#     return ''.join(ff_config.MIDI_MAP_[n] for n in query)


def render_contour(contour):
    rendered = np.zeros((len(contour), ff_config.MIDI_NUM))
    indices = np.arange(len(contour))
    rendered[indices, contour] = 1
    return rendered


# def view_contour(contour):
#     rendered_contour = render_contour(contour)
#     plt.imshow(rendered_contour.T, cmap='gray')
#     plt.show()


# class Contour:
#     def __init__(self, frames_per_beat=8) -> None:
#         self.pitches = []
#         self.lengths = []
#         self.energy = 0.
#         self.tempo_cost = 0.
#         self.pitch_cost = 0.
#         self.frames_per_beat = frames_per_beat

#     @property
#     def bpm(self):
#         return frames_to_bpm(self.frames_per_beat)

#     @property
#     def score(self):
#         return self.energy - self.tempo_cost - self.pitch_cost

#     def score_next_pitch(self, pitch, reward, update):
#         """Compute score that would result from going to next_pitch next."""

#         energy = self.energy
#         inconsistency = self.tempo_cost
#         pitch_cost = self.tempo_cost

#         interval = pitch - self.pitches[-1]
#         is_note_change = interval != 0

#         # If this is a note change, we must apply tempo penalty.
#         if is_note_change:
#             inconsistency += tempo_model.score_note_length(
#                 self.lengths[-1], self.frames_per_beat)

#             pitch_cost += pitch_model.score_pitch_interval(interval)

#         # Add energy 'reward' of new pitch.
#         energy += reward

#         if update is True:
#             self.energy = energy
#             self.tempo_cost = inconsistency
#             self.pitch_cost = pitch_cost

#             if is_note_change:
#                 self.pitches.append(pitch)
#                 self.lengths.append(1)
#             else:
#                 self.lengths[-1] += 1

#         score = energy - inconsistency - pitch_cost
#         return score, is_note_change

#     def __repr__(self):
#         return (f'Pitches:\t{self.pitches}\n'
#                 f'Lengths:\t{self.lengths}\n'
#                 f'Energy:\t\t{self.energy}\n'
#                 f'Inconsistency:\t{self.tempo_cost}\n\n')


# def frames_to_bpm(frames_per_beat):
#     """Convert length (in frames) of one beat to beats per minute"""
#     seconds_per_frame = ff_config.SPEC_WINDOW_SIZE / ff_config.SAMPLE_RATE
#     seconds_per_beat = seconds_per_frame * frames_per_beat
#     beats_per_minute = 60 / seconds_per_beat

#     # Assume that the length in frames is actually one quaver.
#     #   We would normally quote BPM as (crotchet) = ... BPM, hence factor 2.
#     beats_per_minute /= 2

#     return beats_per_minute


# if __name__ == '__main__':
#     print([frames_to_bpm(i) for i in range(5, 20)])
