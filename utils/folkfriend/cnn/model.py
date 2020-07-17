import tensorflow as tf
from folkfriend import ff_config
from tensorflow.keras.layers import (
    Dense, Dropout,
    Flatten, Conv2D,
    MaxPooling2D, LeakyReLU,
    BatchNormalization
)


def assemble_model():
    model = tf.keras.Sequential()

    # TODO safely change ff_config NUM_BINS to 275.
    #   not changing it yet or it'll break other things
    num_bins = 275

    # Input shape needs to be explicitly given for loading into JS
    input_shape = (ff_config.CONTEXT_FRAMES, num_bins, 1)

    model.add(Conv2D(16, 3, activation='relu', input_shape=input_shape))
    model.add(BatchNormalization())
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
    model.add(Dense(num_bins, activation='sigmoid'))

    return model
