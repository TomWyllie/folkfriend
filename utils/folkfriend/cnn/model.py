import tensorflow as tf
from folkfriend import ff_config
from tensorflow.keras.layers import (
    Dense, Dropout, Flatten, Conv2D, MaxPooling2D
)


def assemble_model():
    model = tf.keras.Sequential()

    # Input shape needs to be explicitly given for loading into JS
    input_shape = (ff_config.CONTEXT_FRAMES, ff_config.SPEC_NUM_BINS, 1)

    model.add(Conv2D(4, kernel_size=3, activation='relu', input_shape=input_shape, padding='same'))
    model.add(Conv2D(4, kernel_size=3, activation='relu', padding='same'))
    model.add(MaxPooling2D(pool_size=(1, ff_config.SPEC_BINS_PER_MIDI), strides=(1, ff_config.SPEC_BINS_PER_MIDI)))
    model.add(Conv2D(8, kernel_size=3, activation='relu', padding='valid'))
    model.add(MaxPooling2D(pool_size=(2, 1), strides=(2, 1)))
    model.add(Conv2D(8, kernel_size=3, activation='relu', padding='valid'))

    # So the time feature for each note is a 3 wide (time) by 1 midi note wide (freq) strip,
    #   for each of the 8 CNN filters.
    #   We then just densely map these to the outputs for simplicity.

    model.add(Flatten())
    model.add(Dropout(0.10))
    model.add(Dense(ff_config.MIDI_NUM, activation='sigmoid'))

    return model
