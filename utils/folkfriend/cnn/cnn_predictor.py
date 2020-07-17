import h5py
import tensorflow as tf
from folkfriend import eac
from folkfriend import ff_config
from folkfriend.cnn import cnn_matrix_utils
from scipy.io import wavfile
import numpy as np

class CNNPredictor:
    def __init__(self):
        self.model = None

    @staticmethod
    def load_spectrogram_from_wav(wav_path):
        sr, samples = wavfile.read(wav_path)
        if sr != ff_config.SAMPLE_RATE:
            raise RuntimeError('Sample rate should be {:d} not {:d}'.format(
                ff_config.SAMPLE_RATE, sr
            ))

        spectrogram = eac.compute_ac_spectrogram(samples)
        return eac.linearise_ac_spectrogram(spectrogram, sr)

    def load_model(self, model_path):
        self.model = tf.keras.models.load_model(h5py.File(model_path, 'r'))

    def denoise(self, spectrogram):
        # X shape: (NUM_EXAMPLES, 16, 275)
        # Y shape: (NUM_EXAMPLES, 275)
        input_mat = cnn_matrix_utils.spec_to_cnn_input(spectrogram)
        predictions = self.model(input_mat, training=False)
        predictions = np.round(predictions)     # Make values 1 or 0
        denoised_spec = cnn_matrix_utils.cnn_output_to_spec(predictions)
        return denoised_spec
