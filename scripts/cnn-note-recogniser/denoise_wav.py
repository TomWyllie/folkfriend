import argparse
import os
import pathlib

import imageio
from folkfriend.spectrogram_denoiser import SpectrogramDenoiser
import numpy as np


def main(wav_path, model_dir, out_dir):
    denoiser = SpectrogramDenoiser()
    denoiser.load_model(model_dir)

    noisy_spectrogram = denoiser.load_spectrogram_from_wav(wav_path)
    print(noisy_spectrogram.shape)
    cleaned_spectrogram = denoiser.denoise(noisy_spectrogram)

    pathlib.Path(out_dir).mkdir(parents=True, exist_ok=True)
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
    parser.add_argument('wav', help='Path to input wav file')
    parser.add_argument('model', help='Directory of trained model')
    parser.add_argument('--out', help='Directory to output image files into',
                        default='img')

    args = parser.parse_args()
    main(args.wav, args.model, args.out)
