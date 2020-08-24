import tensorflow as tf
from tensorflow import keras


class WordError(keras.metrics.Metric):
    """
    Calculate the word error between y_true and y_pred.
    """
    def __init__(self, name='word_edit_distance', **kwargs):
        super().__init__(name=name, **kwargs)
        self.total = self.add_weight(name='total', initializer='zeros')
        self.dist = self.add_weight(name='count', initializer='zeros')
                
    def update_state(self, y_true, y_pred, sample_weight=None):
        batch_size = tf.shape(y_true)[0]
        max_width = tf.maximum(tf.shape(y_true)[1], tf.shape(y_pred)[1])
        logit_length = tf.fill([tf.shape(y_pred)[0]], tf.shape(y_pred)[1])        
        decoded, _ = tf.nn.ctc_greedy_decoder(
            inputs=tf.transpose(y_pred, perm=[1, 0, 2]),
            sequence_length=logit_length)
        y_true = tf.sparse.reset_shape(y_true, [batch_size, max_width])
        y_pred = tf.sparse.reset_shape(decoded[0], [batch_size, max_width])
        y_true = tf.cast(y_true, tf.int64)
        distances = tf.edit_distance(y_pred, y_true)
        sum_dist = tf.reduce_sum(distances)
        batch_size = tf.cast(batch_size, tf.float32)
        self.total.assign_add(batch_size)
        self.dist.assign_add(sum_dist)

    def result(self):
        # Value returned is percentage difference between prediction / label
        return 100 * self.dist / self.total

    def reset_states(self):
        self.dist.assign(0)
        self.total.assign(0)
