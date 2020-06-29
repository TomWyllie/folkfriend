"""Helper class to convert frequency bins into MIDI notes, given sample rate."""

import math
import numpy as np


class NoteConverter:
    def __init__(self, sr, n_fft_bins=1024.):
        self.log_base = 2. ** (1. / 12.)
        # Define useful constant. This assumes that note number 0 is 440 Hz
        #   (A4). This is actually midi note 69, so also define the relevant
        #   shift value.
        self.sr = sr
        self.k = sr / 440.
        self.shift = 69
        self.n_fft_bins = n_fft_bins

    def bin_to_midi(self, freq_bin):
        # Convert frequency bins into MIDI notes, according to equation
        #   {midi notes relative to A4} = log_base[2^1/12](sr / (440 * bin))
        if freq_bin == 0:
            raise ValueError('Error - NoteConverter can not handle frequency '
                             'bin zero!')
        return int(
            self.shift + round(math.log(self.k / freq_bin, self.log_base)))

    def bin_to_midi_arr(self, freq_bin):
        # Convert frequency bins into MIDI notes, according to equation
        #   {midi notes relative to A4} = log_base[2^1/12](sr / (440 * bin))
        if np.any(freq_bin == 0):
            raise ValueError(
                'Error - NoteConverter can not handle frequency bin zero!')
        return self.shift + np.log(self.k / freq_bin) / np.log(self.log_base)

    def midi_to_bin(self, midi_note):
        # Convert frequency bins into MIDI notes, according to the inverse of
        #   the above equation
        # {bin number} = (sr / 440) * 2^((shift [rel. to A4] - midi_note) / 12)
        return self.k * 2 ** ((self.shift - midi_note) / 12.)

    def bin_to_hertz(self, freq_bin):
        # Convert FFT frequency bins into frequencies in Hertz
        return self.sr / freq_bin


def midi_to_hertz(midi):
    return 440 * np.power(2, (midi - 69) / 12)


def hertz_to_midi(hertz):
    return 69 + 12 * np.log2(hertz / 440)
