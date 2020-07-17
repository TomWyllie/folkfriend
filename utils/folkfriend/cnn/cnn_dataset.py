import logging
import os

import tensorflow as tf
from folkfriend import ff_config
import math


class CNNDataset:
    def __init__(self, dataset, sub_dir='train', size_cap=None):
        self.logger = logging.getLogger('logger')

        if sub_dir not in {'train', 'val'}:
            raise ValueError()
        self._sub_dir = sub_dir
        self._size_cap = size_cap

        # These are the annotations for the RNN. Given that the successful
        #   creation of the RNN input data (the 'z' image) requires both the
        #   'x' and the 'y' image to be in the expected location we can use
        #   this as a list of paths for the CNN's data (x img in, y img out).
        self._dataset = dataset
        self._annotations_path = os.path.join(dataset, f'{sub_dir}.txt')

    def build(self, batch_size):
        x_img_paths = []
        y_img_paths = []

        with open(self._annotations_path, 'r') as f:
            for line in f:
                z_img_path = line.strip().split()[0]  # "<img_path> <annotation>\n"
                x_img_path = z_img_path.replace('z.png', 'x.png')
                y_img_path = z_img_path.replace('z.png', 'y.png')
                x_img_paths.append(os.path.join(self._dataset, x_img_path))
                y_img_paths.append(os.path.join(self._dataset, y_img_path))

                if self._size_cap and len(x_img_paths) >= self._size_cap:
                    break

        # This is now a dataset of paths
        ds = tf.data.Dataset.from_tensor_slices((x_img_paths, y_img_paths))

        # This is now a dataset of image matrices
        ds = ds.map(self._load_paths,
                    num_parallel_calls=tf.data.experimental.AUTOTUNE)

        ds = ds.map(self._extract_img_slices,
                    num_parallel_calls=tf.data.experimental.AUTOTUNE)

        ds = ds.flat_map(lambda x: x)

        # for x, y in ds.take(5):
        #     print(x.numpy().shape, end=' ')
        #     print(y.numpy().shape)
        # print(ds)
        # exit(0)

        ds = ds.shuffle(buffer_size=10000)
        ds = ds.batch(batch_size, drop_remainder=True)
        ds = ds.apply(tf.data.experimental.ignore_errors())

        # Pre-compute number of batches per epoch for convenience
        samples = ff_config.CNN_DATASET_SAMPLES_PER_IMAGE * len(x_img_paths)
        batches_per_epoch = math.floor(samples / batch_size)

        return ds.prefetch(tf.data.experimental.AUTOTUNE), batches_per_epoch

    def _load_paths(self, x_img_path, y_img_path):
        return self._load_image(x_img_path), self._load_image(y_img_path)

    @staticmethod
    def _load_image(path):
        img = tf.io.read_file(path)
        img = tf.io.decode_png(img, channels=1)
        img = tf.image.transpose(img)
        # Shape is now (batch, 749, 275, 1)
        img = tf.image.convert_image_dtype(img, tf.float32)
        return tf.image.resize(img, (ff_config.SPECTROGRAM_IMG_WIDTH,
                                     ff_config.SPECTROGRAM_IMG_HEIGHT))

    @staticmethod
    def _extract_img_slices(x_img, y_img):
        # Shapes of x_img and y_img are both (749, 275, 1)

        # Pad zeros to x_img so we can still predict a mask for frames
        #   near the edges. This pads evenly at either end.
        x_img = tf.image.resize_with_pad(
            x_img,
            ff_config.SPECTROGRAM_IMG_WIDTH + ff_config.CONTEXT_FRAMES,
            ff_config.SPECTROGRAM_IMG_HEIGHT
        )

        # Now expand *each x/y pair* into *its own mini dataset*. These
        #   will be flattened into one large dataset later.
        # See https://www.tensorflow.org/guide/data#time_series_windowing

        def expand_img_pair_to_sub_dataset(i):
            return x_img[i: i + ff_config.CONTEXT_FRAMES], y_img[i]

        range_ds = tf.data.Dataset.range(ff_config.SPECTROGRAM_IMG_WIDTH)
        range_ds = range_ds.shuffle(ff_config.SPECTROGRAM_IMG_WIDTH)
        range_ds = range_ds.take(ff_config.CNN_DATASET_SAMPLES_PER_IMAGE)
        sub_dataset = range_ds.map(expand_img_pair_to_sub_dataset)

        return sub_dataset
