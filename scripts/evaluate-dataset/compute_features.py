import argparse
import csv
import os
import pathlib

import imageio
import numpy as np
from folkfriend import ff_config
from folkfriend.data import data_ops
from folkfriend.sig_proc import spectrogram
from folkfriend.decoder import decoder
from scipy.io import wavfile
from tqdm import tqdm


def main(dataset):
    slices_path = os.path.join(dataset, 'slices.csv')

    with open(slices_path) as f:
        slices = list(csv.DictReader(f))

    dirs = set()

    # TODO multiprocessing.Pool
    for audio_slice in tqdm([s['path'] for s in slices], desc='Processing Audio to Decodable Features'):
        slice_path = os.path.join(dataset, audio_slice)

        # Be sure to have run the wav conversion script.
        ac_path = slice_path.replace('.wav', '.png')

        sample_rate, signal = wavfile.read(slice_path)
        assert sample_rate == ff_config.SAMPLE_RATE

        slice_dir = os.path.dirname(ac_path)
        if slice_dir not in dirs:
            pathlib.Path(slice_dir).mkdir(parents=True, exist_ok=True)
            dirs.add(slice_dir)

        ac_spec = spectrogram.compute_ac_spectrogram(signal)        
        linear_ac_spec = spectrogram.linearise_ac_spectrogram(ac_spec)
        norm_and_save_png(ac_path.replace('.png', '-a.png'), linear_ac_spec.T)
        
        onset_spec = spectrogram.detect_onsets(linear_ac_spec)
        norm_and_save_png(ac_path.replace('.png', '-b.png'), onset_spec.T)

        fixed_octaves = spectrogram.fix_octaves_alt(onset_spec)
        norm_and_save_png(ac_path.replace('.png', '-c.png'), fixed_octaves.T)
        
        noise_cleaned = spectrogram.clean_noise(fixed_octaves)
        norm_and_save_png(ac_path.replace('.png', '-d.png'), noise_cleaned.T)

        # Spectrogram -> sequence of notes
        contour = decoder.decode(onset_spec)
        norm_and_save_png(ac_path.replace('.png', '-e.png'), contour.T)


def norm_and_save_png(path, img):
    img = np.asarray(img, dtype=np.float32)
    img -= np.min(img)
    img /= np.max(img)
    img *= 255.0
    img = np.asarray(img, dtype=np.uint8)
    imageio.imwrite(path, img)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', default='/home/tom/datasets/tiny-folkfriend-evaluation-dataset')
    # parser.add_argument('--cnn', help='Path to trained CNN model', default='cnn.h5')
    args = parser.parse_args()
    main(args.dataset)
