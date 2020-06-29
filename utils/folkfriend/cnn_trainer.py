import pickle

import imageio
import numpy as np
import tensorflow as tf
from folkfriend import cnn
from folkfriend import ff_config

from cnn_png_dataset import MidiDataset

EPOCHS = 3
BATCH_SIZE = 512


class ModelTrainer:
    def __init__(self):
        # x_train, y_train, x_test, y_test = expand_to_dataset()
        midi_dataset = MidiDataset(path='P:/datasets/png-cnn')
        x_train, y_train, x_test, y_test = midi_dataset.dataset

        # TODO normalisation step?
        # x_train, x_test = x_train / 255.0, x_test / 255.0
        # Add a channels dimension

        # Add a channels dimension
        x_train = x_train[..., tf.newaxis]
        x_test = x_test[..., tf.newaxis]

        train_ds = tf.data.Dataset.from_tensor_slices(
            (x_train, y_train)).shuffle(x_train.shape[0]).batch(BATCH_SIZE)

        test_ds = tf.data.Dataset.from_tensor_slices((x_test, y_test)).batch(
            BATCH_SIZE)

        # Create an instance of the model
        self.model = cnn.NoteCNN()

        self.loss_object = tf.keras.losses.CategoricalCrossentropy()

        self.optimizer = tf.keras.optimizers.Adam()

        self.train_loss = tf.keras.metrics.Mean(name='train_loss')
        self.train_accuracy = tf.keras.metrics.CategoricalCrossentropy(
            name='train_accuracy')

        self.test_loss = tf.keras.metrics.Mean(name='test_loss')
        self.test_accuracy = tf.keras.metrics.CategoricalCrossentropy(
            name='test_accuracy')

        for epoch in range(EPOCHS):
            # Reset the metrics at the start of the next epoch
            self.train_loss.reset_states()
            self.train_accuracy.reset_states()
            self.test_loss.reset_states()
            self.test_accuracy.reset_states()

            for images, labels in train_ds:
                self.train_step(images, labels)

            for i, (test_images, test_labels) in enumerate(test_ds):
                self.test_step(test_images, test_labels)

                if i == 0:
                    predictions = self.model(test_images, training=False)
                    imageio.imwrite('img/{:d}.png'.format(epoch), predictions)

            template = ('Epoch {}, Loss: {}, Accuracy: {}, '
                        'Test Loss: {}, Test Accuracy: {}')
            print(template.format(epoch + 1,
                                  self.train_loss.result(),
                                  self.train_accuracy.result() * 100,
                                  self.test_loss.result(),
                                  self.test_accuracy.result() * 100))

        self.model.save_weights('./checkpoints/latest_train')

    @tf.function
    def train_step(self, images, labels):
        with tf.GradientTape() as tape:
            # training=True is only needed if there are layers with different
            # behavior during training versus inference (e.g. Dropout).
            predictions = self.model(images, training=True)
            loss = self.loss_object(labels, predictions)
        gradients = tape.gradient(loss, self.model.trainable_variables)
        self.optimizer.apply_gradients(zip(gradients,
                                           self.model.trainable_variables))

        self.train_loss(loss)
        self.train_accuracy(labels, predictions)

    @tf.function
    def test_step(self, images, labels):
        # training=False is only needed if there are layers with different
        # behavior during training versus inference (e.g. Dropout).
        predictions = self.model(images, training=False)
        t_loss = self.loss_object(labels, predictions)

        self.test_loss(t_loss)
        self.test_accuracy(labels, predictions)


def expand_to_dataset():
    with open('D:/datasets/dummy-data.pkl', 'rb') as f:
        dummy_data = pickle.load(f)

    # We have pairs of 2D images as the data in dummy_data.
    #   We want our dataset to be mapping a slice of image down
    #   to a single frame for the boolean mask. This expands the dataset
    #   by a factor of CONTEXT_FRAMES without changing the information
    #   content so we do this in memory every time to avoid the dataset
    #   growing too large on disk.

    # Number of frames
    num_frames = dummy_data.shape[2]

    if num_frames < ff_config.CONTEXT_FRAMES:
        raise ValueError('num_frames cannot be less than CONTEXT_FRAMES')

    edge_padding = ff_config.CONTEXT_FRAMES // 2
    num_training_samples = (num_frames - ff_config.CONTEXT_FRAMES) * \
                           dummy_data.shape[1]

    x = np.zeros(
        (num_training_samples, ff_config.CONTEXT_FRAMES, dummy_data.shape[3]))
    y = np.zeros((num_training_samples, dummy_data.shape[3]))

    for frame in range(num_frames - ff_config.CONTEXT_FRAMES - 1):
        # All images at this frame
        x[frame * dummy_data.shape[1]: (frame + 1) * dummy_data.shape[1]] = (
            dummy_data[1, :, frame: (frame + ff_config.CONTEXT_FRAMES), :])
        y[frame * dummy_data.shape[1]: (frame + 1) * dummy_data.shape[1]] = (
            dummy_data[0, :, frame + edge_padding, :])

    validation_split = round(x.shape[0] * 0.9)

    return (x[:validation_split], y[:validation_split],
            x[validation_split:], y[validation_split:])


if __name__ == '__main__':
    ModelTrainer()
