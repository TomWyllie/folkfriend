import tensorflow as tf
from folkfriend import ff_config
from tensorflow.keras.layers import (
    Dense, Dropout,
    Flatten, Conv2D,
    Conv1D, Reshape,
    MaxPooling2D, LeakyReLU
)


def assemble_model():
    model = tf.keras.Sequential()

    # Input shape needs to be explicitly given for loading into JS
    input_shape = (ff_config.CONTEXT_FRAMES, ff_config.SPEC_NUM_BINS, 1)

    model.add(Conv2D(8, 3, activation='relu', input_shape=input_shape, padding='same'))
    model.add(Conv2D(8, 3, activation='relu', padding='same'))

    # Flatten across the 16 filters to create one value for each filter for each bin
    model.add(Conv2D(8, kernel_size=(16, 1), strides=[1, 1], activation='relu', padding='valid'))

    model.add(MaxPooling2D(pool_size=(1, ff_config.SPEC_BINS_PER_MIDI), strides=(1, ff_config.SPEC_BINS_PER_MIDI)))

    model.add(Flatten())
    model.add(Dropout(0.25))
    model.add(Dense(ff_config.MIDI_NUM, activation='sigmoid'))

    return model
