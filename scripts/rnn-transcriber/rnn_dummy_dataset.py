import glob
import os
import pathlib
import random

import imageio
import numpy as np
from folkfriend import ff_config
from tqdm import tqdm


class RNNDummyDataset:
    def __init__(self, dir_path, num=10000,
                 # max_frames=100, bins=ff_config.NUM_MIDIS):
                 max_frames=100, bins=10):

        png_dir = os.path.join(dir_path, 'pngs')
        pathlib.Path(png_dir).mkdir(parents=True, exist_ok=True)

        files = glob.glob(os.path.join(png_dir, '*'))
        for f in files:
            os.remove(f)

        annotations = []

        for example in tqdm(range(num), ascii=True,
                            desc='Generating input data'):

            x = np.zeros((max_frames, bins))
            # y = np.zeros((10, bins),
            #              dtype=np.uint8)  # so all seqs hardcoded to length 10

            # if random.random() > 0.85:
            #     base_frames_per_note = random.randint(25, 40)
            # else:
            #     base_frames_per_note = random.randint(5, 25)

            base_frames_per_note = 10

            # Random offset at start
            # current_frame = np.random.randint(0, 20)
            current_frame = 0
            out_seq = []

            x += np.abs(np.random.normal(
                scale=0.15, size=x.size)).reshape(x.shape)

            while current_frame < max_frames - 1:
                pitch = random.choice(range(bins))
                # note_duration = random.choices(
                #     [1, 2, 3, 4], weights=[0.75, 0.15, 0.04, 0.06]
                # )[0]
                note_duration = 1

                for _ in range(note_duration):
                    t_lo = current_frame
                    t_hi = current_frame + base_frames_per_note

                    t_lo = min(t_lo, max_frames - 1)
                    t_hi = min(t_hi, max_frames - 1)

                    # Input dummy frequency data
                    x[t_lo: t_hi, pitch] += 1

                    out_seq.append(ff_config.MIDI_CHARS[pitch])
                    # out_seq.append(pitch)

                    # Emit note change. pitch + 1 because 0 state is sustain
                    # y[example, t_hi, pitch + 1] = 1
                    # y[example, t_lo, pitch] = 1

                    # Stay in previous state for all other output frames
                    # y[example, 1 + t_lo: t_hi, 0] = 1

                    current_frame = t_hi

                    if current_frame == max_frames - 1:
                        break

            # x = np.asarray(255 * x / np.max(x), dtype=np.uint8).T
            ann = ''.join(out_seq)
            png_file_path = './pngs/{:d}_{}_0.png'.format(
                example, ann)

            imageio.imwrite(os.path.join(dir_path, png_file_path),
                            np.asarray(255 * x / np.max(x), dtype=np.uint8).T)

            annotations.append('{} 1'.format(png_file_path, ann))

            # for i, pitch in enumerate(out_seq):
            #     y[example, i, pitch] = 1
            # imageio.imwrite(seq_png_path, 255 * y[example].T)

        val_split = int(0.9 * num)

        with open(os.path.join(dir_path, 'train.txt'), 'w') as f:
            f.write('\n'.join(annotations[:val_split]))

        with open(os.path.join(dir_path, 'val.txt'), 'w') as f:
            f.write('\n'.join(annotations[val_split:]))


if __name__ == '__main__':
    # RNNDummyDataset('/home/tom/datasets/rnn-dummy')
    RNNDummyDataset('D:/datasets/rnn-dummy')
