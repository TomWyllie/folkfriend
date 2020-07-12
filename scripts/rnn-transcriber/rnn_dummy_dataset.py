import glob
import os
import pathlib
import random
import string
import shutil

import imageio
import numpy as np
from folkfriend import ff_config
from tqdm import tqdm

import math


class RNNDummyDataset:
    def __init__(self, dir_path, num=50000,
                 # max_frames=100, bins=ff_config.NUM_MIDIS):
                 max_frames=750, bins=32):

        # TODO next start messing around with maximum image widths and such

        png_parent_dir = os.path.join(dir_path, 'pngs')
        pathlib.Path(png_parent_dir).mkdir(parents=True, exist_ok=True)

        files = glob.glob(os.path.join(png_parent_dir, '*'))
        for f in files:
            shutil.rmtree(f)

        pngs_per_dir = 500
        num_dirs = math.ceil(num / pngs_per_dir)

        child_dirs = []
        for dir_num in range(num_dirs):
            png_child_dir = os.path.join(png_parent_dir, '{:d}'.format(dir_num))
            pathlib.Path(png_child_dir).mkdir(parents=True, exist_ok=True)
            child_dirs.append(png_child_dir)

        annotations = []

        # TODO specify better
        midi_chars = string.ascii_letters + string.digits

        for example in tqdm(range(num), ascii=True,
                            desc='Generating input data'):

            x = np.zeros((max_frames, bins))
            # y = np.zeros((10, bins),
            #              dtype=np.uint8)  # so all seqs hardcoded to length 10

            if random.random() > 0.85:
                base_frames_per_note = random.randint(25, 56)   # 56 = 50.22 bpm
            else:
                base_frames_per_note = random.randint(7, 25)    # 7 = 401.79 bpm (some notes are very short though)

            # base_frames_per_note = 10

            # Random offset at start
            current_frame = np.random.randint(0, 20)
            # current_frame = 0
            out_seq = []

            x += np.abs(np.random.normal(
                scale=0.07, size=x.size)).reshape(x.shape)

            while current_frame < max_frames - 1:
                if random.random() > 0.97 and out_seq:  # Enforce at least one note
                    pitch = None
                else:
                    pitch = random.choice(range(bins))

                note_duration = random.choices(
                    [1, 2, 3, 4], weights=[0.75, 0.15, 0.04, 0.06]
                )[0]
                # note_duration = 1

                for _ in range(note_duration):
                    t_lo = current_frame
                    t_hi = current_frame + base_frames_per_note

                    t_lo = min(t_lo, max_frames - 1)
                    t_hi = min(t_hi, max_frames - 1)

                    # Input dummy frequency data
                    if pitch is not None:
                        x[t_lo: t_hi, pitch] += 1
                        out_seq.append(midi_chars[pitch])

                    current_frame = t_hi

                    if current_frame == max_frames - 1:
                        break

            # x = np.asarray(255 * x / np.max(x), dtype=np.uint8).T
            ann = ''.join(out_seq)
            chunk_num = example // pngs_per_dir
            png_file_name = '{:d}_{}_0.png'.format(example, ann)
            png_file_path_string = './pngs/{:d}/{}'.format(chunk_num, png_file_name)

            png_child_dir = child_dirs[chunk_num]
            imageio.imwrite(os.path.join(png_child_dir, png_file_name),
                            np.asarray(255 * x / np.max(x), dtype=np.uint8).T)

            annotations.append('{} {}'.format(png_file_path_string, ann))

            # for i, pitch in enumerate(out_seq):
            #     y[example, i, pitch] = 1
            # imageio.imwrite(seq_png_path, 255 * y[example].T)

        val_split = int(0.9 * num)

        with open(os.path.join(dir_path, 'train.txt'), 'w') as f:
            f.write('\n'.join(annotations[:val_split]))

        with open(os.path.join(dir_path, 'val.txt'), 'w') as f:
            f.write('\n'.join(annotations[val_split:]))


if __name__ == '__main__':
    RNNDummyDataset('/home/tom/datasets/rnn-dummy')
    # RNNDummyDataset('D:/datasets/rnn-dummy')
