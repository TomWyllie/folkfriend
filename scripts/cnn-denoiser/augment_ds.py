"""Augment a dataset by using the true output of the CNN as input to the RNN,
    rather than the ideal output. This means the RNN can go some way to
    learning the mistakes the CNN is likely to make and improve performance."""
import argparse
import os

import imageio
import numpy as np
from folkfriend import ff_config
from folkfriend.cnn.denoiser import CNNDenoiser
from folkfriend.data.data_ops import spec_to_pseudo
from tqdm import tqdm


def main(model_path, ds_dir):
    ds_train_paths = os.path.join(ds_dir, 'train.txt')
    ds_val_paths = os.path.join(ds_dir, 'val.txt')

    ds_paths = []

    with open(ds_train_paths) as f, open(ds_val_paths) as g:
        lines = (line for h in (f, g) for line in h)
        for line in lines:
            ds_paths.append(line.split()[0].strip())

    denoiser = CNNDenoiser()
    denoiser.load_model(model_path)

    for d_path in tqdm(ds_paths, desc='Running CNN over dataset'):
        output_pseudo_spec_path = os.path.join(ds_dir, d_path.lstrip('./'))
        original_spec_path = output_pseudo_spec_path.replace('d.png', 'a.png')

        original_spec = imageio.imread(original_spec_path).T
        mask, denoised = denoiser.denoise(original_spec)
        pseudo_spec = spec_to_pseudo(denoised)

        img = np.asarray(255 * pseudo_spec / np.max(pseudo_spec),
                         dtype=np.uint8).T
        imageio.imwrite(output_pseudo_spec_path, img)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('model', help='Path to trained model')
    parser.add_argument('-d', '--dir',
                        default=ff_config.DEFAULT_DS_DIR_,
                        help='Path to dataset directory')

    args = parser.parse_args()
    main(args.model, args.dir)
