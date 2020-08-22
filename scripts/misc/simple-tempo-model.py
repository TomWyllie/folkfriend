import os

import numpy as np
import imageio
# noinspection PyPackageRequirements
import matplotlib.pyplot as plt

# Sane range is 50 - 300 bpm
#           =   100 - 600 quavers per minute
#           =   5/3 - 10 quavers per second
#           =   0.1 - 0.6 seconds per quaver (or per pulse)
#           =   4.6875 - 28.125     frames per pulse
#           ~=  4.5    - 30         frames per pulse

# One frame is 1024 / 48000 = 21.3ms
fpp_min = 4.5
fpp_max = 30.0
min_note_event_size = 5


def main():
    ds_dir = '/home/tom/datasets/old-folkfriend/pngs/99'
    for d_img in os.listdir(ds_dir):
        if not d_img.endswith('d.png'):
            continue

        img_path = os.path.join(ds_dir, d_img)
        decode_img_path(img_path)


def main2():
    # ds_dir = '/home/tom/repos/folkfriend/scripts/evaluate-dataset/07-Aug-2020/cucb'
    # ds_dir = '/home/tom/repos/folkfriend/scripts/evaluate-dataset/07-Aug-2020/fergal'
    ds_dir = '/scripts/evaluate-dataset/07-Aug-2020/martial'
    for d_img in os.listdir(ds_dir):
        if 'd-rnn-input' not in d_img:
            continue

        img_path = os.path.join(ds_dir, d_img)
        decode_img_path(img_path)


def decode_img_path(img_path):
    clean_sig = imageio.imread(img_path).T

    plt.imshow(clean_sig.T, cmap='gray')
    plt.show()

    if len(clean_sig.shape) == 3:
        # RGB channels meaningless for black and white
        clean_sig = np.sum(clean_sig, axis=0)

    # Keep it simple, stupid.
    maxes = np.argmax(clean_sig, axis=1)
    v = np.zeros_like(clean_sig)
    v[np.arange(maxes.size), maxes] = 1
    plt.imshow(v.T, cmap='gray')
    plt.show()

    note_events = [[0, maxes[0]]]
    for i, m in enumerate(maxes):
        if m != note_events[-1][1]:
            if i - note_events[-1][0] < min_note_event_size:
                del note_events[-1]
            else:
                note_events[-1].append(i)
            note_events.append([i, m])
    note_events[-1].append(maxes.size)

    clean_sig = np.zeros_like(clean_sig)
    for start, pitch, end in note_events:
        clean_sig[start:end, pitch] = 1

    plt.imshow(clean_sig.T, cmap='gray')
    plt.show()


def tempo_from_note_events():
    scores = {}
    for score in range(5, 30):
        # TODO score
        # KEEP IT SIMPLE STUPID
        pass


if __name__ == '__main__':
    # decode_img_path('/home/tom/Downloads/maddie-js/maddie_d.png')
    # main()
    main2()
