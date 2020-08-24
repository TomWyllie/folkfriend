import argparse
import os

from folkfriend.rnn.decoder import RNNDecoder


def main(model_path, images, out_file):
    decoder = RNNDecoder()
    decoder.load_model(model_path)

    if os.path.isdir(images):
        img_paths = [os.path.join(images, img)
                     for img in os.listdir(images)]
        img_paths = [p for p in img_paths if p.endswith('d.png')]
    else:
        img_paths = [images]

    if not img_paths:
        print('No paths found!')

    out_lines = []
    for img_path in img_paths:
        decoded_output = decoder.decode(img_path)
        line = '{:<36}{}\t{}'.format(img_path, *decoded_output)
        print(line)
        out_lines.append(line)

    with open(out_file, 'w') as f:
        f.write('\n'.join(out_lines))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('model', help='Path to trained model')
    parser.add_argument('img', help='Path to input image file or directory')
    parser.add_argument('--out', help='File to output decoded sequences into',
                        default='decoded.txt')
    args = parser.parse_args()
    main(args.model, args.img, args.out)
