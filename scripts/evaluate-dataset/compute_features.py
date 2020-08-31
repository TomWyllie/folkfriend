import argparse
import csv
import os
import pathlib

import imageio
import numpy as np
from folkfriend.sig_proc import spectrogram
from scipy.io import wavfile


def main(dataset):
    slices_path = os.path.join(dataset, 'slices.csv')

    with open(slices_path) as f:
        slices = list(csv.DictReader(f))

    dirs = set()

    for audio_slice in [s['path'] for s in slices]:
        slice_path = os.path.join(dataset, audio_slice)

        # Be sure to have run the wav conversion script.
        ac_path = slice_path.replace('.wav', '.png')

        sample_rate, signal = wavfile.read(slice_path)
        ac_spec = spectrogram.compute_ac_spectrogram(signal)
        linear_ac_spec = spectrogram.linearise_ac_spectrogram(ac_spec)

        slice_dir = os.path.dirname(ac_path)
        if slice_dir not in dirs:
            pathlib.Path(slice_dir).mkdir(parents=True, exist_ok=True)
            dirs.add(slice_dir)

        linear_ac_spec *= 255 / np.max(linear_ac_spec)
        linear_ac_spec = np.asarray(linear_ac_spec, dtype=np.uint8)
        print(ac_path)
        imageio.imwrite(ac_path, linear_ac_spec.T)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', default='/home/tom/datasets/evaluation-tunes')
    args = parser.parse_args()
    main(args.dataset)
