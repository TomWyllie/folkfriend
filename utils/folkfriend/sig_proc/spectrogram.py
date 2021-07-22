import numpy as np
import scipy.interpolate as interp
from scipy.signal import convolve2d

from folkfriend import ff_config
from folkfriend.sig_proc import note

import matplotlib.pyplot as plt

# This keeps ff_config serialisable for export to JS
NP_LINEAR_MIDI_BINS = np.asarray(ff_config.LINEAR_MIDI_BINS_)


def compute_ac_spectrogram(signal, window_size=ff_config.SPEC_WINDOW_SIZE):
    # WebAudio in JS seems to be adding a first quantum of zeros so for
    #   comparison between JS and Python adding in 128 samples
    #   is useful, so the frames are aligned (debugging).
    # signal = np.concatenate((np.zeros(128), signal))
    # signal /= 32768

    # 1024 / 48000 = 21.33 ms
    num_frames = signal.size // window_size

    signal_windowed = np.reshape(
        signal[:window_size * num_frames], (num_frames, window_size))

    signal = (signal_windowed * np.hanning(window_size))

    # Power spectra of each window
    spectra = np.fft.fft(signal)

    # This next step corresponds to a "k-value" of 1/3, see
    #   https://labrosa.ee.columbia.edu/~dpwe/papers/ToloK2000-mupitch.pdf
    #   (which recommends k as 2/3)
    spectrogram = np.cbrt(np.abs(spectra))

    # Forwards FFT is equivalent to IFFT here so either can be used.
    #   This was useful when running our own implementation of FFT
    #   as it meant we used FFT twice rather than separate FFT / IFFT
    #   implementations.
    spectrogram = np.fft.rfft(spectrogram).real

    # Peak pruning
    spectrogram[spectrogram < 0] = 0

    return spectrogram


def linearise_ac_spectrogram(spectrogram):
    # Remember high bin = low frequency and vice versa
    nc = note.NoteConverter()

    # Remove DC bin as it has frequency = 0 = midi note -infinity.
    spectrogram = spectrogram[:, 1:]  # Keep all frames, remove first bin

    # Resample to linearly spaced (in musical notes)
    bin_midi_values = nc.bin_to_midi_arr(
        np.arange(start=1, stop=1 + spectrogram.shape[1], step=1)
    )

    return interp.interp1d(bin_midi_values,
                           spectrogram)(NP_LINEAR_MIDI_BINS)


def fix_octaves(spectrogram):
    # Remove time stretched copy (a la enhanced autocorrelation)
    out = spectrogram.copy()
    out[:, 12:] -= out[:, :-12]
    out[out < 0] = 0
    return out


def fix_octaves_alt(spectrogram):
    # Remove harmonics. For a frequency X, if X + octave has greater
    #   energy then zero out X and set X + octave equal to the sum of
    #   the two energies. Repeat twice so three harmonics can collapse to
    #   one.

    # This only makes sense if there are the same number of bins per note
    #   i.e. if MIDI_NUM is a multiple of 12.
    assert ff_config.MIDI_NUM % 12 == 0

    spectrogram = spectrogram.copy()

    # spectrogram = np.zeros_like(spectrogram)
    # spectrogram[:, 15] = 1
    # spectrogram[:, 15 + 12] = 0.5

    # plt.imshow(spectrogram.T, cmap='gray')
    # plt.show()

    num_octaves = ff_config.MIDI_NUM // 12

    # [frames, bins] -> [frames, bins (one octave), octaves]
    spectrogram = spectrogram.reshape(
        (-1, num_octaves, 12))

    mask = spectrogram[:, 1:, :] < spectrogram[:, :-1, :]

    # Now perform the zeroing / stacking on each octave, sequentially
    for octave in range(num_octaves - 1, 0, -1):

        # Carry up applicable energy by an octave
        spectrogram[:, octave - 1, :] += (spectrogram[:, octave, :]
                                  * mask[:, octave - 1, :])

        # Zero spectrogram energy that has moved up an octave
        spectrogram[:, octave, :] = spectrogram[:, octave, :] * (1 - mask[:, octave - 1, :])
        
    spectrogram = spectrogram.reshape((-1, ff_config.MIDI_NUM))

    # plt.imshow(spectrogram.T, cmap='gray')
    # plt.show()
    # exit()

    return spectrogram

def detect_onsets(spectrogram):

    # onset_filter = np.array([[-1, -1, -1, -1, 1, 1, 1]]).T
    onset_filter = np.cos([np.linspace(-np.pi, 0, num=8, endpoint=True)]).T

    onset = convolve2d(spectrogram, onset_filter, mode='same')
    onset[onset < 0] = 0

    # return onset

    spectrogram = onset.reshape(
        (-1, ff_config.MIDI_NUM, ff_config.SPEC_BINS_PER_MIDI))

    # Sum multiple bins per note into one bin per note
    spectrogram = np.sum(spectrogram, axis=2)

    return spectrogram

# def notes_only_spectrogram(spectrogram):
#     """Bin frequencies into one octave, with one bin per note."""

#     # This only makes sense if there are the same number of bins per note
#     #   i.e. if MIDI_NUM is a multiple of 12.
#     assert ff_config.MIDI_NUM % 12 == 0

#     # [frames, bins] -> [frames, bins (one octave), octaves]
#     spectrogram = spectrogram.reshape(
#         (-1, 12 * ff_config.SPEC_BINS_PER_MIDI, ff_config.MIDI_NUM // 12))

#     # Sum bins across octaves
#     spectrogram = np.sum(spectrogram, axis=2)

#     # Now reduce to one bin per note
#     # spectrogram = spectrogram.reshape((-1, ff_config.SPEC_BINS_PER_MIDI, 12))

#     # Sum multiple bins per note into one bin per note
#     # spectrogram = np.sum(spectrogram, axis=1)

#     return spectrogram


if __name__ == '__main__':
    spec = np.zeros((500, 48))
    spec[:, 10] = 10
    spec[:, 22] = 5
    print(fix_octaves(spec).shape)
