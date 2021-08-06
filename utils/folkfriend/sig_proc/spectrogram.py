import enum
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

    signal = (signal_windowed * np.blackman(window_size))

    # Power spectra of each window
    spectra = np.fft.fft(signal)

    # This next step corresponds to a "k-value" of 1/3, see
    #   https://labrosa.ee.columbia.edu/~dpwe/papers/ToloK2000-mupitch.pdf
    #   (which recommends k as 2/3)
    # spectrogram = np.cbrt(np.abs(spectra))
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
    # Remove harmonics. For a frequency X, if X + octave has greater
    #   energy then zero out X and set X + octave equal to the sum of
    #   the two energies. Repeat twice so three harmonics can collapse to
    #   one.

    # This only makes sense if there are the same number of bins per note
    #   i.e. if MIDI_NUM is a multiple of 12.
    assert ff_config.MIDI_NUM % 12 == 0

    spectrogram = spectrogram.copy()

    num_octaves = ff_config.MIDI_NUM // 12

    # [frames, bins] -> [frames, bins (one octave), octaves]
    spectrogram = spectrogram.reshape(
        (-1, num_octaves, 12))

    mask = spectrogram[:, 1:,
                       :] < ff_config.OCTAVE_DEDUPE_THRESH * spectrogram[:, :-1, :]

    # Now perform the zeroing / stacking on each octave, sequentially
    for octave in range(num_octaves - 1, 0, -1):

        # Carry up applicable energy by an octave
        spectrogram[:, octave - 1, :] += (spectrogram[:, octave, :]
                                          * mask[:, octave - 1, :])

        # Zero spectrogram energy that has moved up an octave
        spectrogram[:, octave, :] = spectrogram[:,
                                                octave, :] * (1 - mask[:, octave - 1, :])

    spectrogram = spectrogram.reshape((-1, ff_config.MIDI_NUM))

    # plt.imshow(spectrogram.T, cmap='gray')
    # plt.show()
    # exit()

    return spectrogram


# def detect_pitches(spectrogram):
#     # pitch_filter = [[-1.0, -0.3, 0.0, 0.8, 1.0, 0.8, 0.0, -0.3, -1.0]]
#     # pitch_filter = [[-1.20, -0.68, 0.16, 1.01, 1.40, 1.01, 0.16, -0.68, -1.20]]
#     pitch_filter = [[
#         -1.5392, -1.2192, -0.6592, 0.1208, 0.9033, 1.5008, 1.7857,
#         1.5008, 0.9033, 0.1208, -0.6592, -1.2192, -1.5392]
#     ]
#     pitches = convolve2d(spectrogram, pitch_filter, mode='same')
#     pitches[pitches < 0] = 0
#     return pitches


def sum_to_midis(spectrogram):

    # onset_filter = np.cos([np.linspace(-np.pi, 0, num=8, endpoint=True)]).T
    # onset = convolve2d(spectrogram, onset_filter, mode='same')
    # onset[onset < 0] = 0

    # spectrogram = onset.reshape(
    spectrogram = spectrogram.reshape(
        (-1, ff_config.MIDI_NUM, ff_config.SPEC_BINS_PER_MIDI))

    # Sum multiple bins per note into one bin per note
    spectrogram = np.sum(spectrogram, axis=2)

    return spectrogram


def clean_noise(spectrogram):
    """Remove noise from spectrogram by retaining only high energy bins"""

    # Retain only top 5 most energetic bins at each frame

    for i in range(len(spectrogram)):
        zero_inds = np.argsort(-spectrogram[i])[5:]
        spectrogram[i, zero_inds] = 0

    # energy_by_bin = np.max(spectrogram, axis=0)
    # energy_by_bin /= np.sum(energy_by_bin)

    # bins_by_energy = np.argsort(-energy_by_bin)
    # energy_by_bin = np.cumsum(energy_by_bin[bins_by_energy])

    # bins_to_zero = bins_by_energy[np.where(energy_by_bin > cutoff)]
    # spectrogram[:, bins_to_zero] = 0

    return spectrogram


if __name__ == '__main__':
    spec = np.zeros((500, 48))
    spec[:, 10] = 10
    spec[:, 22] = 5
    print(fix_octaves(spec).shape)
