import os
import re

import tensorflow as tf
from folkfriend import ff_config
from folkfriend.data.tf_data_ops import load_pseudo_spec_png


class UnsupportedFormatError(Exception):
    """Error class for unsupported format"""


def read_annotation(path):
    """Read an annotation file to get image paths and labels."""
    print(f'Annotation path: {path}, format: ', end='')
    with open(path) as f:
        line = f.readline().strip()
        if re.fullmatch(r'.*/*\d+_.+_(\d+)\.\w+ \1', line):
            print('MJSynth')
            content = [l.strip().split() for l in f.readlines() + [line]]
            img_paths, labels = zip(*content)
            labels = [path.split('_')[1] for path in img_paths]
        elif re.fullmatch(r'.*/*word_\d\.\w+, ".+"', line):
            print('ICDAR2013')
            content = [l.strip().split(',') for l in f.readlines() + [line]]
            img_paths, labels = zip(*content)
            labels = [label.strip(' "') for label in labels]
        elif re.fullmatch(r'.+\.\w+ .+', line):
            print('[image path] label')
            content = [l.strip().split() for l in f.readlines() + [line]]
            for i, c in enumerate(content):
                if len(c) == 1:
                    # Add blank to any empty
                    content[i].append('-')
            img_paths, labels = zip(*content)
        else:
            raise UnsupportedFormatError('Unsupported annotation format')
    dirname = os.path.dirname(path)
    img_paths = [os.path.join(dirname, img_path) for img_path in img_paths]
    return img_paths, labels


def read_annotations(paths):
    """Read annotation files to get image paths and labels."""
    img_paths = []
    labels = []
    for path in paths:
        part_img_paths, part_labels = read_annotation(path)
        img_paths.extend(part_img_paths)
        labels.extend(part_labels)
    return img_paths, labels


class DatasetBuilder:
    def __init__(self, table_path):
        self.table = tf.lookup.StaticHashTable(tf.lookup.TextFileInitializer(
            table_path, tf.string, tf.lookup.TextFileIndex.WHOLE_LINE,
            tf.int64, tf.lookup.TextFileIndex.LINE_NUMBER), -1)
        self.img_width = ff_config.SPEC_NUM_FRAMES
        self.img_channels = 1
        self.num_classes = self.table.size()
        if self.num_classes != ff_config.RNN_CLASSES_NUM_:
            raise ValueError(f"{self.num_classes} is not equal to "
                             f"{ff_config.RNN_CLASSES_NUM_}")

        print('NUM_CLASSES', self.num_classes)

    @staticmethod
    def decode_and_resize(filename, label):
        return load_pseudo_spec_png(filename), label

    def tokenize(self, imgs, labels):
        chars = tf.strings.unicode_split(labels, 'UTF-8')
        tokens = tf.ragged.map_flat_values(self.table.lookup, chars)
        tokens = tokens.to_sparse()
        return imgs, tokens

    def build(self, ann_paths, shuffle, batch_size):
        """
        build dataset, it will auto detect each annotation file's format.
        """
        img_paths, labels = read_annotations(ann_paths)
        # if self.ignore_case:
        #     labels = [label.lower() for label in labels]
        size = len(img_paths)
        ds = tf.data.Dataset.from_tensor_slices((img_paths, labels))
        if shuffle:
            ds = ds.shuffle(buffer_size=10000)
        ds = ds.map(self.decode_and_resize,
                    num_parallel_calls=tf.data.experimental.AUTOTUNE)
        # Ignore the errors e.g. decode error or invalid data.

        # for x, y in ds.take(10):
        #     print(tf.math.reduce_max(x).numpy())      # 1.0
        #     print(tf.math.reduce_min(x).numpy())      # 0.0
        #     print(x.numpy().shape)                    # (375, 48)
        # exit()

        # ds = ds.apply(tf.data.experimental.ignore_errors())
        ds = ds.batch(batch_size)
        ds = ds.map(self.tokenize,
                    num_parallel_calls=tf.data.experimental.AUTOTUNE)
        ds = ds.prefetch(tf.data.experimental.AUTOTUNE)

        return ds, size
