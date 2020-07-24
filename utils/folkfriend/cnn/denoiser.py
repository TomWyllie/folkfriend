import numpy as np
import tensorflow as tf
from folkfriend import ff_config
from folkfriend.data.data_ops import (pseudo_to_spec,
                                      spec_to_cnn_input)
from folkfriend.sig_proc.spectrogram import (compute_ac_spectrogram,
                                             linearise_ac_spectrogram)
from scipy.io import wavfile


class CNNDenoiser:
    def __init__(self):
        self.model = None

    @staticmethod
    def load_spectrogram_from_wav(wav_path):
        sr, samples = wavfile.read(wav_path)
        if sr != ff_config.SAMPLE_RATE:
            raise RuntimeError('Sample rate should be {:d} not {:d}'.format(
                ff_config.SAMPLE_RATE, sr
            ))

        spectrogram = compute_ac_spectrogram(samples)
        return linearise_ac_spectrogram(spectrogram)

    def load_model(self, model_path):
        self.model = tf.keras.models.load_model(model_path)

    def denoise(self, spectrogram):
        # X shape: (NUM_EXAMPLES, 16, 275)
        # Y shape: (NUM_EXAMPLES, 275)
        input_mat = spec_to_cnn_input(spectrogram)
        prediction = self.model(input_mat, training=False)

        # mask = pseudo_to_spec(np.round(prediction))
        mask = pseudo_to_spec(prediction.numpy())

        denoised = mask * spectrogram
        return mask, denoised
