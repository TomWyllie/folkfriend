from tensorflow import keras
from tensorflow.keras import layers

from folkfriend import ff_config


def build_model():
    """build CNN-RNN model"""

    inputs = keras.Input(shape=(ff_config.SPEC_NUM_FRAMES, ff_config.MIDI_NUM))

    x = inputs
    x = layers.Bidirectional(layers.LSTM(units=72, return_sequences=True))(x)
    x = layers.Bidirectional(layers.LSTM(units=72, return_sequences=True))(x)
    x = layers.Dense(units=ff_config.RNN_CLASSES_NUM_)(x)
    return keras.Model(inputs=inputs, outputs=x, name='RNN')
