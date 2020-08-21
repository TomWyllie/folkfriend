import numpy as np
import scipy.interpolate as interp

from folkfriend import ff_config
from folkfriend.sig_proc import note

# This keeps ff_config serialisable for export to JS
NP_LINEAR_MIDI_BINS = np.asarray(ff_config.LINEAR_MIDI_BINS)


def compute_ac_spectrogram(signal, window_size=ff_config.SPEC_WINDOW_SIZE):
    # 1024 / 48000 = 21.33 ms
    num_frames = signal.size // window_size

    signal_windowed = np.reshape(
        signal[:window_size * num_frames], (num_frames, window_size))

    signal = (signal_windowed * np.blackman(window_size))

    # Cube root of power spectrum
    spectra = np.fft.fft(signal)

    # This next step corresponds to a "k-value" of 2/3, which is recommended
    #   as the best value for magnitude compression in
    #   https://labrosa.ee.columbia.edu/~dpwe/papers/ToloK2000-mupitch.pdf
    # TODO we are now actually using (1/2)*(1/3) = (1/6)
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
