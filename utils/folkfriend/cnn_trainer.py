import tensorflow as tf
from folkfriend import cnn
import os

class ModelTrainer:
    def __init__(self, dataset, model_dir, epochs, batch_size):
        x_train, y_train, x_test, y_test = dataset

        self.train_ds = tf.data.Dataset.from_tensor_slices(
            (x_train, y_train)).shuffle(x_train.shape[0]).batch(batch_size)

        self.test_ds = tf.data.Dataset.from_tensor_slices(
            (x_test, y_test)).batch(batch_size)

        self.model_dir = model_dir
        self.epochs = epochs

        self.model = cnn.get_note_cnn()
        self.loss_object = tf.keras.losses.CategoricalCrossentropy()
        self.optimizer = tf.keras.optimizers.Adam()

        self.train_loss = tf.keras.metrics.Mean(name='train_loss')
        self.train_accuracy = tf.keras.metrics.CategoricalCrossentropy(
            name='train_accuracy')

        self.test_loss = tf.keras.metrics.Mean(name='test_loss')
        self.test_accuracy = tf.keras.metrics.CategoricalCrossentropy(
            name='test_accuracy')

    def train(self):
        """Fit the dataset to the model."""
        for epoch in range(self.epochs):
            # Reset the metrics at the start of the next epoch
            self.train_loss.reset_states()
            self.train_accuracy.reset_states()
            self.test_loss.reset_states()
            self.test_accuracy.reset_states()

            for images, labels in self.train_ds:
                self.train_step(images, labels)

            for test_images, test_labels in self.test_ds:
                self.test_step(test_images, test_labels)

            template = ('Epoch {}, Loss: {}, Accuracy: {}, '
                        'Test Loss: {}, Test Accuracy: {}')
            print(template.format(epoch + 1,
                                  self.train_loss.result(),
                                  self.train_accuracy.result(),
                                  self.test_loss.result(),
                                  self.test_accuracy.result()))

        print('Finished training model. Saving to {}'.format(self.model_dir))
        self.model.save(os.path.join(self.model_dir, 'model.h5'))

    @tf.function
    def train_step(self, images, labels):
        with tf.GradientTape() as tape:
            # training=True is needed as there are layers with different
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
        predictions = self.model(images, training=False)
        t_loss = self.loss_object(labels, predictions)

        self.test_loss(t_loss)
        self.test_accuracy(labels, predictions)
