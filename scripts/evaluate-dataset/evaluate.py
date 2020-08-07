import argparse
import audio2numpy
import csv
import os
import pathlib
from datetime import datetime
from tqdm import tqdm
import json

import imageio
import numpy as np
from folkfriend.cnn.denoiser import CNNDenoiser
from folkfriend.data.data_ops import spec_to_pseudo
from folkfriend.rnn.decoder import RNNDecoder
from folkfriend import ff_config


def main(cnn, rnn, dataset):
    denoiser = CNNDenoiser()
    denoiser.load_model(cnn)

    out_dir = datetime.now().strftime('%d-%b-%Y')
    pathlib.Path(out_dir).mkdir(parents=True, exist_ok=True)

    recordings_data_path = os.path.join(dataset, 'recordings.csv')
    with open(recordings_data_path) as f:
        recordings_data = list(csv.DictReader(f))

    dataset_sub_dirs = {os.path.dirname(d['path'])
                        for d in recordings_data}

    for dataset_sub_dir_name in dataset_sub_dirs:
        dataset_sub_dir_path = os.path.join(out_dir, dataset_sub_dir_name)
        pathlib.Path(dataset_sub_dir_path).mkdir(parents=True, exist_ok=True)

    rnn_input_data = []
    audio_samples_per_query = (ff_config.SAMPLE_RATE *
                               ff_config.AUDIO_QUERY_SECS)
    for i, dataset_entry in tqdm(enumerate(recordings_data),
                                 desc='Extracting features for RNN'):
        audio_path = os.path.join(dataset, dataset_entry['path'])
        signal, sample_rate = audio2numpy.open_audio(audio_path)
        for j in range(signal.size // audio_samples_per_query):
            base_img_path = os.path.join(out_dir, dataset_entry['path'])
            # TODO change order of number and stage
            base_img_path = base_img_path[:-4] + '-{}-{:d}.png'

            stage_labels = [
                base_img_path.format('a-spec', j),
                base_img_path.format('b-mask', j),
                base_img_path.format('c-denoised', j),
                base_img_path.format('d-rnn-input', j)
            ]

            # Track this path so we can load it back in when we iterate
            #   over the list again.
            rnn_input_entry = recordings_data[i].copy()
            rnn_input_entry['rnn-input'] = stage_labels[-1]
            rnn_input_data.append(rnn_input_entry)

            if os.path.exists(stage_labels[-1]):
                print(f'Found pre-existing path {stage_labels[-1]}')
                continue

            original_spec = denoiser.load_spectrogram_from_signal_data(
                sample_rate, signal[j * audio_samples_per_query:
                                    (j + 1) * audio_samples_per_query]
            )

            mask, denoised = denoiser.denoise(original_spec)
            rnn_input = spec_to_pseudo(denoised)

            for path, img in zip(stage_labels,
                                 (original_spec, mask, denoised, rnn_input)):
                imageio.imwrite(path, np.asarray(
                    255 * img.T / np.max(img), dtype=np.uint8))

    decoder = RNNDecoder()
    decoder.load_model(rnn)

    for i, dataset_entry in tqdm(enumerate(rnn_input_data),
                                 desc='Decoding with RNN'):
        decoded_output = decoder.decode(dataset_entry['rnn-input'])
        rnn_input_data[i]['decoded'] = decoded_output

    print(recordings_data)
    with open('output.json', 'w') as f:
        json.dump(recordings_data, f)

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
