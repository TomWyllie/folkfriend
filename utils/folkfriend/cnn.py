from tensorflow.keras import Model
from tensorflow.keras.layers import (Dense, Dropout, Flatten, Conv2D,
                                     MaxPooling2D, LeakyReLU)

from folkfriend import ff_config


class NoteCNN(Model):
    def __init__(self):
        super(NoteCNN, self).__init__()

        self.conv1 = Conv2D(16, 3, activation='relu')
        self.relu1 = LeakyReLU()
        self.conv2 = Conv2D(16, 3, activation='relu')
        self.relu2 = LeakyReLU()
        self.pool2 = MaxPooling2D(pool_size=(2, 2))
        self.dropout2 = Dropout(0.25)

        self.conv3 = Conv2D(16, 3, activation='relu')
        self.relu3 = LeakyReLU()
        self.conv4 = Conv2D(16, 3, activation='relu')
        self.relu4 = LeakyReLU()
        self.pool4 = MaxPooling2D(pool_size=(2, 2))
        self.dropout4 = Dropout(0.25)

        self.flatten = Flatten()
        self.dense1 = Dense(128, activation='relu')
        self.relu5 = LeakyReLU()
        self.dropout5 = Dropout(0.5)
        self.dense2 = Dense(ff_config.NUM_BINS, activation='sigmoid')

    def call(self, x, **kwargs):
        x = self.conv1(x)
        x = self.relu1(x)
        x = self.conv2(x)
        x = self.relu2(x)
        x = self.pool2(x)

        x = self.conv3(x)
        x = self.relu3(x)
        x = self.conv4(x)
        x = self.relu4(x)
        x = self.pool4(x)

        x = self.flatten(x)
        x = self.dense1(x)
        x = self.relu5(x)
        x = self.dropout5(x)
        x = self.dense2(x)

        return x
