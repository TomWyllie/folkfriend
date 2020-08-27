import collections
import os
from pprint import pprint

import timeit
import imageio
import numpy as np

from folkfriend import ff_config

timer_vals = []


def main():
    ds = 'img'
    decoder = Decoder()

    for filename in sorted(os.listdir(ds), reverse=True):
        if not filename.endswith('a_d.png'):
            continue

        print(filename)

        path = os.path.join(ds, filename)
        img = imageio.imread(path).T

        maxes = np.argmax(img, axis=1)
        maxes_img = np.zeros_like(img)
        maxes_img[np.arange(maxes_img.shape[0]), maxes] = 255

        imageio.imwrite(path.replace('d.png', 'e.png'), maxes_img.T)

        decoder.decode(
            # Convert away from numpy types, as this won't be vectorised.
            [int(m) for m in maxes],
            [float(e) for e in img[np.arange(maxes_img.shape[0]), maxes]],
            filename.replace('.png', '')
        )

        # break

    ms_per_norm = 1000 * sum(timer_vals) / len(timer_vals)
    print('Each call _normalise_events_by_tempo averaged '
          '{:.6f} ms'.format(ms_per_norm))


class Decoder:
    def __init__(self):
        self.event = collections.namedtuple(
            'MidiEvent', ['start', 'duration', 'pitch', 'power'])
        pass

    def decode(self, midis, bin_energies, debug_label):
        """midis is a list of midi note values at each frame. As frames are
        short, notes will span multiple frames, so expect midis to consist
        of many consecutive identical notes, but also to include noise."""

        # Convert list of midi notes to list of midi note 'events'
        events = self._midis_to_events(midis, bin_energies)

        # Argmax defaults to zero. This corresponds to silence.
        #   This means we have may some zero power events (with pitch 0).
        #   Remove very short notes (<= 2 frames) and silence.
        events = [e for e in events if e.power > 0 and e.duration > 2]

        # Debugging only
        tempos = list(range(50, 360, 5))
        scores = []
        import matplotlib.pyplot as plt
        for tempo in tempos:
            decoded, score = self._normalise_events_by_tempo(events, tempo)
            scores.append(score)
            fpq = round(self._bpm_to_num_frames(tempo))

            img = np.zeros([fpq * len(decoded), ff_config.MIDI_NUM],
                           dtype=np.uint8)
            decoded = np.asarray(decoded).repeat(fpq)
            img[np.arange(decoded.size), decoded] = 255
            imageio.imwrite(f'scores/{debug_label}-{tempo}.png', img.T)

        # plt.clf()
        # plt.plot(tempos, scores)
        # plt.savefig(f'scores/{debug_label}-score.png')

    def _normalise_events_by_tempo(self, events, tempo):
        t0 = timeit.default_timer()

        # Simple algorithm to decode events to a queryable sequence, given a
        #   tempo in BPM.
        fpq = self._bpm_to_num_frames(tempo)
        input_num_frames = events[-1].start + events[-1].duration

        output_query = []
        quant_error = 0
        quant_quaver_values = []

        for e in events:
            # Simply choose nearest whole number of quavers.
            #   But be more lenient to giving each least one.
            exact_quavers = e.duration / fpq
            if exact_quavers > 1. / 3:
                quant_quavers = max(1, round(exact_quavers))
            else:
                quant_quavers = 0

            # What is the quantisation error? Scale this by power
            #   so quantisation error is more important on stronger
            #   notes.
            quant_quaver_values.append(quant_quavers)
            output_query.extend([e.pitch] * quant_quavers)
            quant_error += abs(exact_quavers - quant_quavers) * e.power

        # We cannot rely on quantisation error alone. Clearly the optimal
        #   solution under this constraint is a tempo of one frame per
        #   quaver, so the error is always zero. This corresponds to a
        #   tempo of (crotchet) = 1406.25 which is utterly humanly
        #   impossible. Sane values are 50 - 300, with most tunes being
        #   played somewhere between 100 - 200. 300 BPM is incredibly fast,
        #   and 50 BPM is painfully slow.

        # We use a very simple model of how many notes we expect to see before
        #   the note changes (ie the distribution of values of quant_error).
        log_likelihood_approx = sum((3 - 0.5 * x) for x in quant_quaver_values if x)

        # Normalise by number of quantised quavers, otherwise there's a
        #   bias towards shorter tempos which have more positive scores.
        log_likelihood_approx /= len(quant_quaver_values)

        # The quantisation error can be a maximum of num_frames * avg_power
        #   but we normalised power to 1 (although some events have been
        #   removed since then so the average power can be slightly greater).
        quant_scale = (1 - quant_error / input_num_frames)

        # Overall error in tempo
        total_frame_delta = abs(fpq * len(output_query) - input_num_frames)
        overall_time_error = 1 - total_frame_delta / input_num_frames

        # Roughly, quant_scale belongs to [0, 1] so scales down the log
        #   likelihood if there's inaccuracy.
        score = quant_scale * log_likelihood_approx * overall_time_error

        timer_vals.append(timeit.default_timer() - t0)

        return output_query, score

    def _midis_to_events(self, midis, bin_energies):
        events = []

        # We normalise the energies so the average power is 1
        num_energies = len(bin_energies)
        total_energy = sum(bin_energies)

        if total_energy == 0:
            return []

        energy_norm = num_energies / total_energy

        for i, (pitch, energy) in enumerate(zip(midis, bin_energies)):
            if events and pitch == events[-1][2]:
                # Increment duration
                events[-1][1] += 1

                # Cumulative energy sum
                events[-1][3] += energy * energy_norm
            else:
                if events:
                    # Average the energy over the duration.
                    #   This is the power (energy / time).
                    #   This is "dimensionless" because
                    #   we scaled by energy_norm
                    events[-1][3] /= events[-1][1]
                events.append([i, 1, pitch, energy])

        return [self.event(*e) for e in events]

    @staticmethod
    def _bpm_to_num_frames(bpm):
        """Convert a BPM tempo into a float of frames per quaver"""
        bps = bpm / 60
        quavers_ps = bps * 2  # Quaver = half a crotchet
        frames_ps = ff_config.SAMPLE_RATE / ff_config.SPEC_WINDOW_SIZE
        frames_per_quaver = frames_ps / quavers_ps
        return frames_per_quaver


if __name__ == '__main__':
    main()
