import argparse

from folkfriend.spectrogram_denoiser import SpectrogramDenoiser


def main(model_dir):
    denoiser = SpectrogramDenoiser()
    denoiser.load_model(model_dir)
    # denoiser.model.


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('model', help='Directory of trained model')
    args = parser.parse_args()
    main(args.model)
