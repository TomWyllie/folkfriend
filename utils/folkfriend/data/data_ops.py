import numpy as np

from folkfriend import ff_config


def spec_to_cnn_input(img):
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

    # Add a channels dimension
    input_mat = input_mat[..., np.newaxis]

    return normalise(input_mat)


def normalise(x):
    x -= np.min(x)
    x /= np.max(x)
    return x


def spec_to_pseudo(spec):
    spec = np.asarray(spec, np.float64)
    spec = spec.reshape((-1, spec.shape[1] // ff_config.SPEC_BINS_PER_MIDI,
                         ff_config.SPEC_BINS_PER_MIDI)).sum(axis=2)
    return spec / ff_config.SPEC_BINS_PER_MIDI


def pseudo_to_spec(ps):
    return ps.repeat(ff_config.SPEC_BINS_PER_MIDI, axis=1)


def cnn_output_to_spec(output_mat):
    return np.vstack(output_mat)
