import numpy as np
import scipy.interpolate as interp

from folkfriend import ff_config
from folkfriend.sig_proc import note

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

    # Cube root of power spectrum
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


if __name__ == '__main__':
    spec = np.zeros((500, 48))
    spec[:, 10] = 10
    spec[:, 22] = 5
    print(fix_octaves(spec).shape)
