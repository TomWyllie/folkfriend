import argparse
import audio2numpy
import csv
import os
import pathlib
from datetime import datetime
from tqdm import tqdm

import imageio
import numpy as np
from folkfriend.cnn.denoiser import CNNDenoiser
from folkfriend.data.data_ops import spec_to_pseudo
from folkfriend.rnn.decoder import RNNDecoder


def main(cnn, rnn, dataset):
    denoiser = CNNDenoiser()
    denoiser.load_model(cnn)

    out_dir = datetime.now().strftime('%d-%b-%Y-%H%M%S')
    pathlib.Path(out_dir).mkdir(parents=True, exist_ok=False)

    recordings_data_path = os.path.join(dataset, 'recordings.csv')
    with open(recordings_data_path) as f:
        recordings_data = list(csv.DictReader(f))

    dataset_sub_dirs = {os.path.dirname(d['path'])
                        for d in recordings_data}

    for dataset_sub_dir_name in dataset_sub_dirs:
        dataset_sub_dir_path = os.path.join(dataset, dataset_sub_dir_name)
        pathlib.Path(dataset_sub_dir_path).mkdir(parents=True, exist_ok=False)

    for dataset_entry in tqdm(recordings_data,
                              desc='Extracting features for RNN'):
        audio_path = os.path.join(dataset, dataset_entry['path'])
        signal, sample_rate = audio2numpy.open_audio(audio_path)
        original_spec = denoiser.load_spectrogram_from_signal_data(
            sample_rate, signal)

        mask, denoised = denoiser.denoise(original_spec)

        base_img_path = os.path.join(dataset, dataset_entry['path'])
        base_img_path = base_img_path[:-4] + '-{}.png'

        for path, img in (
                (base_img_path.format('a-spec'), original_spec),
                (base_img_path.format('b-mask'), mask),
                (base_img_path.format('c-denoised'), denoised),
        ):
            imageio.imwrite(path, np.asarray(255 * img.T / np.max(img),
                                             dtype=np.uint8))
        # pseudo_spec = spec_to_pseudo(denoised)

    return

    # decoder = RNNDecoder()
    # decoder.load_model(model_path)

    # out_lines = []
    # for img_path in img_paths:
    #     decoded_output = decoder.decode(img_path)
    #     line = '{:<36}{}\t{}'.format(img_path, *decoded_output)
    #     print(line)
    #     out_lines.append(line)

    # with open(out_file, 'w') as f:
    #     f.write('\n'.join(out_lines))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('dataset', help='Path to dataset wav file or directory')
    parser.add_argument('--cnn', help='Path to trained CNN model', default='cnn.h5')
    parser.add_argument('--rnn', help='Path to trained RNN model', default='rnn.h5')
    args = parser.parse_args()
    main(args.cnn, args.rnn, args.dataset)
