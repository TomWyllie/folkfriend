import tensorflow as tf
from folkfriend import ff_config

from folkfriend.data.tf_data_ops import load_pseudo_spec_png
from folkfriend.rnn.model import build_model
from folkfriend.data.abc import ABC_MAP


class RNNDecoder:
    def __init__(self):
        self.model = None

    def load_model(self, model_path):
        self.model = build_model()
        self.model.compile()
        self.model.load_weights(model_path)

    def decode(self, path):
        # Img shape: (num_frames, 48)
        pseudo_spectrogram = load_pseudo_spec_png(path)
        pseudo_spectrogram = tf.expand_dims(pseudo_spectrogram, 0)
        predictions = self.model.predict(pseudo_spectrogram)

        predictions = tf.transpose(predictions, [1, 0, 2])
        sparse_decoded, _ = tf.nn.ctc_greedy_decoder(
            inputs=predictions,
            sequence_length=[predictions.shape[0]],
            merge_repeated=True)

        # MIDI_NUM index is the last value in MIDI_MAP which is length
        #   MIDI_NUM + 1.
        decoded = tf.sparse.to_dense(
            sparse_decoded[0], default_value=ff_config.MIDI_NUM).numpy()[0]

        rnn_string = ''.join(ff_config.MIDI_MAP[x] for x in decoded)
        abc_string = ' '.join(ABC_MAP[x] for x in decoded)

        return rnn_string, abc_string