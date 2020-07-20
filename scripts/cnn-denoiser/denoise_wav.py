import argparse
import os
import pathlib

import imageio
from folkfriend.cnn.cnn_predictor import CNNPredictor
import numpy as np


def main(wav_path, model_dir, out_dir):
    denoiser = CNNPredictor()
    denoiser.load_model(model_dir)
    pathlib.Path(out_dir).mkdir(parents=True, exist_ok=True)

    if os.path.isdir(args.wav):
        wav_paths = [os.path.join(args.wav, wav_file)
                     for wav_file in os.listdir(args.wav)]
        wav_paths = [p for p in wav_paths if p.endswith('.wav')]
    else:
        wav_paths = [wav_path]

    if not wav_paths:
        print('No paths found!')

    for wav_path in wav_paths:
        noisy_spectrogram = denoiser.load_spectrogram_from_wav(wav_path)
        print(noisy_spectrogram.shape)
        cleaned_spectrogram = denoiser.denoise(noisy_spectrogram)

        img_label = os.path.basename(wav_path)[:-4]

        for stage, spec in zip('abc', [
            noisy_spectrogram,
            cleaned_spectrogram,
            noisy_spectrogram * cleaned_spectrogram
        ]):
            out_path = os.path.join(out_dir, '{}_{}.png'.format(img_label, stage))
            img = np.asarray(255 * spec / np.max(spec), dtype=np.uint8).T
            imageio.imwrite(out_path, img)
            print('Wrote {}'.format(out_path))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('model', help='Path to trained model')
    parser.add_argument('wav', help='Path to input wav file or directory')
    parser.add_argument('--out', help='Directory to output image files into',
                        default='img')

    args = parser.parse_args()
    main(args.wav, args.model, args.out)
