import numpy as np
import scipy.interpolate as interp

from folkfriend import ff_config
from folkfriend import note


def compute_ac_spectrogram(signal,
                           window_size=ff_config.SPECTROGRAM_WINDOW_SIZE,
                           hop_size=ff_config.SPECTROGRAM_HOP_SIZE):
    # 1024 / 48000 = 21.33 ms
    # 512 / 48000 = 10.67 ms
    num_frames = signal.size // hop_size

    # Trim excess samples that won't fill a window
    signal = signal[:window_size * num_frames]

    signal_windowed = np.empty(shape=(num_frames - 1, window_size))
    for n in range(num_frames - 1):
        signal_windowed[n] = signal[n * hop_size:n * hop_size + window_size]

    signal = (signal_windowed * np.hanning(window_size))

    # Cube root of power spectrum
    spectrogram = np.absolute(np.fft.fft(signal)) ** (1. / 3.)
    spectrogram = np.fft.rfft(spectrogram).real

    # Peak pruning
    spectrogram[spectrogram < 0] = 0
    spectrogram = spectrogram[:,
                              ff_config.AC_LOW_THRESH: ff_config.AC_HIGH_THRESH]
    return spectrogram


def linearise_ac_spectrogram(spectrogram, sr):
    # Remember high bin = low frequency and vice versa
    nc = note.NoteConverter(sr=sr)

    # Resample to linearly spaced (in musical notes)
    bin_midi_values = nc.bin_to_midi_arr(
        np.arange(
            start=ff_config.AC_LOW_THRESH,
            stop=ff_config.AC_HIGH_THRESH,
            step=1)
    )

    linear_midi_values = np.linspace(
        start=ff_config.HIGH_MIDI,
        stop=ff_config.LOW_MIDI,
        num=ff_config.NUM_BINS,
        endpoint=False
    )

    return interp.interp1d(bin_midi_values, spectrogram)(linear_midi_values)
