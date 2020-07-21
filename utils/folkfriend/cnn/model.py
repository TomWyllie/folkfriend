import tensorflow as tf
from folkfriend import ff_config
from tensorflow.keras.layers import (
    Dense, Dropout,
    Flatten, Conv2D,
    MaxPooling2D, LeakyReLU
)


def assemble_model():
    model = tf.keras.Sequential()

    # Input shape needs to be explicitly given for loading into JS
    input_shape = (ff_config.CONTEXT_FRAMES, ff_config.SPEC_NUM_BINS, 1)

    model.add(Conv2D(16, 3, activation='relu', input_shape=input_shape))
    model.add(LeakyReLU())
    model.add(Conv2D(16, 3, activation='relu'))
    model.add(LeakyReLU())
    model.add(MaxPooling2D(pool_size=(2, 2)))
    model.add(Dropout(0.25))

    model.add(Conv2D(16, 3, activation='relu'))
    model.add(LeakyReLU())
    model.add(Conv2D(16, 3, activation='relu'))
    model.add(LeakyReLU())
    model.add(MaxPooling2D(pool_size=(2, 2)))
    model.add(Dropout(0.25))

    model.add(Flatten())
    model.add(Dense(128, activation='relu'))
    model.add(LeakyReLU())
    model.add(Dropout(0.5))
    model.add(Dense(ff_config.SPEC_NUM_BINS, activation='sigmoid'))

    return model
