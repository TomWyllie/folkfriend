from scipy.io import wavfile
from folkfriend.sig_proc import spectrogram

import imageio

sr, samples = wavfile.read('/home/tom/Music/fiddle.wav')
ac_spec = spectrogram.compute_ac_spectrogram(samples)
lac_spec = spectrogram.linearise_ac_spectrogram(ac_spec)
imageio.imwrite('fiddle.png', lac_spec.T)
