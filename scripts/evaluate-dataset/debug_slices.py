import argparse
import csv
import os
import random

import imageio
import numpy as np
from folkfriend import ff_config
from folkfriend.decoder import decoder
from folkfriend.sig_proc import spectrogram
from scipy.io import wavfile
from tqdm.contrib.concurrent import process_map

import csv_headers


def main(dataset):
    slices_path = os.path.join(dataset, 'labeled_slices.csv')

    with open(slices_path) as f:
        slices = list(csv.DictReader(f))

        assert all(list(slice.keys()) == csv_headers.LABELED_SLICES
                   for slice in slices)
        multiproc_input = [(dataset, slice) for slice in slices]

        # Shuffle so we can subsample output
        # random.shuffle(multiproc_input)
        multiproc_input = multiproc_input[::-1]

    process_map(transcribe_file, multiproc_input,
                desc='Transcribing Audio Files', chunksize=1)


def transcribe_file(args):
    dataset, slice = args
    abs_path = os.path.join(dataset, slice['rel_path'])
    img_path = abs_path.replace('.wav', '.png')
    sample_rate, signal = wavfile.read(abs_path)

    assert sample_rate == ff_config.SAMPLE_RATE

    ac_spec = spectrogram.compute_ac_spectrogram(signal)
    linear_ac_spec = spectrogram.linearise_ac_spectrogram(ac_spec)
    norm_and_save_png(img_path.replace('.png', '-a.png'), linear_ac_spec.T)

    pitch_spec = spectrogram.detect_pitches(linear_ac_spec)
    norm_and_save_png(img_path.replace('.png', '-b.png'), pitch_spec.T)

    onset_spec = spectrogram.detect_onsets(pitch_spec)
    norm_and_save_png(img_path.replace('.png', '-c.png'), onset_spec.T)

    fixed_octaves = spectrogram.fix_octaves(onset_spec)
    norm_and_save_png(img_path.replace('.png', '-d.png'), fixed_octaves.T)

    noise_cleaned = spectrogram.clean_noise(fixed_octaves)
    norm_and_save_png(img_path.replace('.png', '-e.png'), noise_cleaned.T)

    # Spectrogram -> sequence of notes
    _, expanded_contour = decoder.decode(noise_cleaned)

    norm_and_save_png(img_path.replace('.png', '-f.png'), expanded_contour.T)


def norm_and_save_png(path, img):
    img = np.asarray(img, dtype=np.float32)
    img -= np.min(img)
    img /= np.max(img)
    img *= 255.0
    img = np.asarray(img, dtype=np.uint8)
    imageio.imwrite(path, img)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--dataset', default='/home/tom/datasets/tiny-folkfriend-evaluation-dataset')
    args = parser.parse_args()
    main(args.dataset)
