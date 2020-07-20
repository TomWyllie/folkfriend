import numpy as np
import scipy.interpolate as interp

from folkfriend import ff_config
from folkfriend import note


def compute_ac_spectrogram(signal,
                           window_size=ff_config.SPEC_WINDOW_SIZE,
                           hop_size=ff_config.SPEC_HOP_SIZE):
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
    spectra = np.fft.fft(signal)
    # This corresponds to a "k-value" of 2/3, which is recommended
    #   as the best value for magnitude compression in
    #   https://labrosa.ee.columbia.edu/~dpwe/papers/ToloK2000-mupitch.pdf
    spectrogram = np.cbrt((spectra * spectra.conj()).real)

    # Forwards FFT is equivalent to IFFT here so either can be used.
    #   This was useful when running our own implementation of FFT
    #   as it meant we used FFT twice rather than separate FFT / IFFT
    #   implementations.
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

    return interp.interp1d(bin_midi_values,
                           spectrogram)(ff_config.LINEAR_MIDI_BINS)
