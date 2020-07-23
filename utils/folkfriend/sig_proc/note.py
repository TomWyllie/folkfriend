"""Helper class to convert frequency bins into MIDI notes, given sample rate."""

import numpy as np
from folkfriend import ff_config


class NoteConverter:
    def __init__(self):
        self.log_base = 2. ** (1. / 12.)
        # Define useful constant. This assumes that note number 0 is 440 Hz
        #   (A4). This is actually midi note 69, so also define the relevant
        #   shift value.
        self.k = ff_config.SAMPLE_RATE / 440.
        self.shift = 69

    def bin_to_midi_arr(self, freq_bin):
        # Convert frequency bins into MIDI notes, according to equation
        #   {midi notes relative to A4} = log_base[2^1/12](sr / (440 * bin))
        if np.any(freq_bin == 0):
            raise ValueError('Cannot convert frequency bin zero')
        return self.shift + np.log(self.k / freq_bin) / np.log(self.log_base)

    def midi_to_bin(self, midi_note):
        # Convert frequency bins into MIDI notes, according to the inverse of
        #   the above equation
        # {bin number} = (sr / 440) * 2^((shift [rel. to A4] - midi_note) / 12)
        return self.k * 2 ** ((self.shift - midi_note) / 12.)


def midi_to_hertz(midi):
    return 440 * np.power(2, (midi - 69) / 12)


def hertz_to_midi(hertz):
    return 69 + 12 * np.log2(hertz / 440)
