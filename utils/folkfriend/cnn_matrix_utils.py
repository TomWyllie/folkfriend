import numpy as np

from folkfriend import ff_config


def image_to_cnn_input(img):
    # img shape: (NUM_FRAMES, NUM_BINS)
    # input_mat shape: (NUM_FRAMES, CONTEXT_FRAMES, NUM_BINS)

    input_mat = np.zeros((img.shape[0], ff_config.CONTEXT_FRAMES, img.shape[1]))

    for i in range(img.shape[0]):
        lo = i - ff_config.CONTEXT_FRAMES // 2
        hi = i + ff_config.CONTEXT_FRAMES // 2

        lo_c = max(0, lo)
        hi_c = min(hi, img.shape[0] - 1)

        input_mat[i, lo_c - lo: ff_config.CONTEXT_FRAMES + (hi_c - hi), :] = (
            img[lo_c: hi_c, :])

    # Normalise to [0, 1]
    input_mat -= np.min(input_mat)
    input_mat /= np.max(input_mat)

    # Add a channels dimension
    input_mat = input_mat[..., np.newaxis]

    return input_mat


def cnn_output_to_image(output_mat):
    return np.vstack(output_mat)


def image_to_cnn_output(img):
    raise NotImplementedError()


image_to_cnn_input(np.arange(200).reshape(20, 10))
