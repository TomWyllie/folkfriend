import tensorflow as tf
from folkfriend import ff_config


def load_pseudo_spec_png(filename):
    png = tf.io.read_file(filename)
    img = tf.io.decode_png(png, channels=1)  # [48, 375, 1]
    img = tf.image.transpose(img)  # -> [375, 48, 1]
    img = tf.image.resize(img, (ff_config.SPEC_NUM_FRAMES, ff_config.MIDI_NUM))
    img = tf.image.convert_image_dtype(img, tf.float32)

    assert img.shape[1] == ff_config.MIDI_NUM
    img = tf.squeeze(img)  # -> [375, 48]
    return img
