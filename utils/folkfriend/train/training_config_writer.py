import os
import json
import tempfile

from tensorflow import keras


class TrainingConfigWriter(keras.callbacks.Callback):
    def __init__(self, timestamp):
        self._train_start_timestamp = timestamp
        super().__init__()

    def on_epoch_end(self, epoch, logs=None):
        self._write_config(epoch)

    # def on_train_end(self, logs=None):
    #     os.remove(self.get_config_path())

    def _write_config(self, epoch):
        with open(self.get_config_path(), 'w') as f:
            config = {
                'localtime': self._train_start_timestamp,
                'epoch': epoch
            }
            json.dump(config, f)

    @staticmethod
    def get_config_path():
        return os.path.join(tempfile.gettempdir(), 'latest-tf-keras-train.json')
