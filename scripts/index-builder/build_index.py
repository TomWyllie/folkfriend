import argparse
import collections
import json
import logging
import math
import os
import pathlib

from folkfriend import ff_config
from folkfriend.data import midi
from folkfriend.data.download import download_thesession_data
from tqdm import tqdm

logging.basicConfig(level=logging.DEBUG,
                    format='[%(name)s:%(lineno)s] %(message)s')
log = logging.getLogger(os.path.basename(__file__))


def build_index(ds_dir):
    tunes_path = os.path.join(ds_dir, 'thesession-data.json')
    index_path = os.path.join(ds_dir, 'index', 'query-data.txt')
    index_meta_path = os.path.join(ds_dir, 'index', 'meta-query-data.json')
    index_midis_path = os.path.join(ds_dir, 'index', 'midis')

    pathlib.Path(index_midis_path).mkdir(parents=True, exist_ok=True)

    download_thesession_data(tunes_path)

    with open(tunes_path, 'r') as f:
        thesession_data = json.load(f)

    contours = []

    for setting in tqdm(thesession_data,
                        desc='Converting ABC text to queryable index'):
        # break
        abc_header = [
            'X:1',
            'T:',
            f'M:{setting["meter"].strip()}',
            f'K:{setting["mode"].strip()}'
        ]
        abc_body = setting['abc'].replace(
            '\\', '').replace(
            '\r', '').split('\n')
        abc = '\n'.join(abc_header + abc_body)

        midi_out_path = os.path.join(index_midis_path,
                                     '{}.midi'.format(setting['setting']))

        if not os.path.exists(midi_out_path):
            midi.abc_to_midi(abc, midi_out_path)

        midi_events = midi.midi_as_csv(midi_out_path)
        note_contour = midi.CSVMidiNoteReader(midi_events).to_note_contour()

        contours.append((setting['setting'], note_contour))

    # with open('contours.json', 'w') as f:
    #     json.dump(contours, f)
    # with open('contours.json', 'r') as f:
    #     contours = json.load(f)

    # import matplotlib.pyplot as plt
    # lengths = [len(c) for s, c in contours]
    # lengths = collections.Counter(lengths)
    # print(lengths)
    #  192: 6761,
    #  256: 3567,
    #  128: 3216,
    #  255: 2690,
    #   64: 1782,
    #  144: 1071,
    #  383: 837,
    #   96: 664...
    #
    # x = []
    # y = []
    # for i in range(1000):
    #     x.append(i)
    #     y.append(lengths[i])
    # plt.plot(x, y)
    # plt.show()
    # Big spikes at multiples of 64.

    shard_size = 64
    shards = collections.defaultdict(list)
    total_overlap = 0

    for setting_id, contour in tqdm(contours, desc='Sharding contours'):
        if not contour:
            continue

        num_shards = math.ceil(len(contour) / shard_size)
        overlapping_notes = num_shards * shard_size - len(contour)
        overlaps = partition_x_into_n(overlapping_notes, num_shards)
        total_overlap += overlapping_notes

        contour = 2 * contour
        next_s = 0
        for i in range(num_shards):
            shard = contour[next_s: next_s + shard_size]
            shards[shard].append(setting_id)
            next_s += shard_size
            next_s -= overlaps[i]

    # (Changes shards to a list for this to work) TODO improve
    # x = len(shards)
    # y = len(set(shards))
    # print(x, y, x - y)
    # print('Extra efficiency from de-duplicating shards ', shard_size * (x - y))
    # print('Inefficiency from overlaps ', total_overlap)
    # > 133435 123375 10060
    # > Extra efficiency from de-duplicating shards 643840
    # > Inefficiency from overlaps 564268

    shard_lines = list(shards.keys())
    shard_meta = [0] * len(shards)
    for i, shard in enumerate(shard_lines):
        # noinspection PyTypeChecker
        shard_meta[i] = shards[shard]

    with open(index_path, 'w') as f:
        f.writelines('\n'.join(shard_lines))

    with open(index_meta_path, 'w') as f:
        json.dump(shard_meta, f)


def partition_x_into_n(x, n):
    """Partition a range of x into n as-equally-as-possible sized chunks.
        12, 4 -> [3, 3, 3, 3]
        21, 3 -> [7, 7, 7]
        23, 3 -> [7, 8, 8]
        38, 4 -> [9, 9, 10, 10]
    """
    lo = x // n
    remainder = x % n
    return (n - remainder) * [lo] + remainder * [lo + 1]


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir',
                        default=ff_config.DEFAULT_DS_DIR,
                        help='Directory to contain the dataset files in')
    args = parser.parse_args()
    build_index(args.dir)
