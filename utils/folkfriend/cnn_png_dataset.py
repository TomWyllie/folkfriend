import logging
import os

import imageio
import numpy as np
from folkfriend import ff_config
from tqdm import tqdm


# TODO tidy up using matrix_utils

class CNNPngDataset:
    def __init__(self, path='/home/tom/datasets/png-cnn'):
        self.logger = logging.getLogger('logger')

        png_dir = os.path.join(path, 'pngs')

        x_imgs = {}
        y_imgs = {}

        for path in tqdm(os.listdir(png_dir), ascii=True, desc='Loading PNGs'):
            img = imageio.imread(os.path.join(png_dir, path)).T
            if path.endswith('x.png'):
                x_imgs[path[:-5]] = img
            elif path.endswith('y.png'):
                y_imgs[path[:-5]] = img
            else:
                self.logger.warning('Illegal file {}'.format(path))

        x_indices = set(x_imgs.keys())
        y_indices = set(y_imgs.keys())

        missing_indices = x_indices ^ y_indices
        for index in missing_indices:
            self.logger.warning(
                'Input or output missing for index {}'.format(index))

        paired_indices = x_indices & y_indices
        for index in paired_indices:
            try:
                if x_imgs[index].shape == y_imgs[index].shape:
                    continue
            except AttributeError:
                self.logger.warning('Invalid input for index {}'.format(index))
            x_imgs.pop(index, None)
            y_imgs.pop(index, None)

        total_num_samples = (sum(x.shape[0] for x in x_imgs.values())
                             - ff_config.CONTEXT_FRAMES * len(x_imgs))

        dataset_bytes = total_num_samples * (1 + ff_config.CONTEXT_FRAMES) * 280
        print('Dataset will be {:.6f} MB'.format(dataset_bytes / (2 ** 20)))

        # We can be more clever than loading it all into memory at once, but
        #   until then this is a safety check to prevent using too much.
        if dataset_bytes > 10 * (2 ** 30):
            raise RuntimeError('Dataset bigger than 10 GB - halting in case'
                               'memory issues occur.')

        # We have pairs of 2D images as the data in the pngs folder.
        #   We want our dataset to be mapping a slice of image down
        #   to a single frame for the boolean mask. This expands the dataset
        #   by a factor of CONTEXT_FRAMES without changing the information
        #   content so we do this in memory every time to avoid the dataset
        #   growing too large on disk.

        # X shape: (NUM_EXAMPLES, 16, 280)
        # Y shape: (NUM_EXAMPLES, 280)

        x = np.zeros((total_num_samples, ff_config.CONTEXT_FRAMES, 280))
        y = np.zeros((total_num_samples, 280))

        sample = 0
        for index, x_img in tqdm(x_imgs.items(),
                                 ascii=True, desc='Partitioning dataset'):
            y_img = y_imgs[index]

            for j in range(x_img.shape[0] - ff_config.CONTEXT_FRAMES):
                x[sample, :, :] = x_img[j: j + ff_config.CONTEXT_FRAMES, :]
                y[sample, :] = y_img[j + ff_config.CONTEXT_FRAMES // 2, :]
                sample += 1

        # Add a channels dimension
        x = x[..., np.newaxis]

        print('Loaded input data, ', x.shape)
        print('Loaded output data, ', y.shape)

        validation_split = round(total_num_samples * 0.9)
        self.dataset = (
            x[:validation_split], y[:validation_split],
            x[validation_split:], y[validation_split:])
