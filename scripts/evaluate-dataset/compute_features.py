import argparse
import csv
import os
import pathlib

import imageio
import numpy as np
from folkfriend.sig_proc import spectrogram
from folkfriend.cnn import denoiser
from folkfriend.data import data_ops
from scipy.io import wavfile

from tqdm import tqdm


def main(dataset, model):
    slices_path = os.path.join(dataset, 'slices.csv')

    cnn_denoiser = denoiser.CNNDenoiser()
    cnn_denoiser.load_model(model)

    with open(slices_path) as f:
        slices = list(csv.DictReader(f))

    dirs = set()

    for audio_slice in tqdm([s['path'] for s in slices], desc='Processing Audio to Decodable Features'):
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

        mask, denoised = cnn_denoiser.denoise(linear_ac_spec)

        # Sum along values for each MIDI note
        denoised = data_ops.spec_to_pseudo(denoised)

        # This quantisation error gives rounds some zeros which is handy
        denoised /= np.max(denoised)
        denoised *= 255.0
        denoised = np.asarray(denoised, dtype=np.int64)

        octaves_fixed = spectrogram.fix_octaves(denoised)

        norm_and_save_png(ac_path.replace('.png', '-a.png'), linear_ac_spec.T)
        norm_and_save_png(ac_path.replace('.png', '-b.png'), mask.T)
        norm_and_save_png(ac_path.replace('.png', '-o.png'), octaves_fixed.T)
        norm_and_save_png(ac_path, denoised.T)


def norm_and_save_png(path, img):
    img = np.asarray(img, dtype=np.float32)
    img -= np.min(img)
    img /= np.max(img)
    img *= 255.0
    img = np.asarray(img, dtype=np.uint8)
    imageio.imwrite(path, img)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', default='/home/tom/datasets/evaluation-tunes')
    parser.add_argument('--cnn', help='Path to trained CNN model', default='cnn.h5')
    args = parser.parse_args()
    main(args.dataset, args.cnn)
