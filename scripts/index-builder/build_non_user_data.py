import argparse
import base64
import collections
import json
import logging
import math
import os
import pathlib
import imageio

from folkfriend import ff_config
from folkfriend.data import midi
from folkfriend.data.download import (
    download_thesession_data,
    download_thesession_aliases
)
from tqdm import tqdm
import numpy as np

logging.basicConfig(level=logging.DEBUG,
                    format='[%(name)s:%(lineno)s] %(message)s')
log = logging.getLogger(os.path.basename(__file__))


def build_non_user_data(p_dir):
    tunes_path = os.path.join(p_dir, 'thesession-data.json')
    aliases_path = os.path.join(p_dir, 'thesession-aliases.json')
    midis_dir = os.path.join(p_dir, 'midis')
    non_user_data_path = os.path.join('folkfriend-non-user-data.json')
    imgs_path_template = os.path.join(p_dir, 'img', 'query-data-{}.{}')

    pathlib.Path(p_dir).mkdir(parents=True, exist_ok=True)
    pathlib.Path(os.path.dirname(imgs_path_template)).mkdir(parents=True, exist_ok=True)
    pathlib.Path(midis_dir).mkdir(parents=True, exist_ok=True)

    download_thesession_data(tunes_path)
    with open(tunes_path, 'r') as f:
        thesession_data = json.load(f)

    download_thesession_aliases(aliases_path)
    with open(aliases_path, 'r') as f:
        thesession_aliases = json.load(f)

    # We convert the ABC files to a form more directly usable by a search
    #   engine. ABC files contain non-trivial syntax that must be properly
    #   parsed and it is unsuitable to require this running on the edge
    #   before first use, so we do this once and distribute a this as part
    #   of the non-user data file.

    # But - we would still like the original ABC string as it is used to
    #   render the sheet music (and going back from our queryable
    #   representation into ABC is even harder than the reverse as that's
    #   a non-unique mapping. However there's some other information in the
    #   JSON file from thesession.org's GitHub that isn't useful for us.
    log.info('Creating cleaned version of input data file')
    cleaned_thesession_data = clean_thesession_data(thesession_data)

    log.info('Gathering tune name aliases')
    gathered_aliases = gather_aliases(thesession_aliases)

    # The heavy lifting is done here
    contours = generate_midi_contours(thesession_data, midis_dir)
    shards = shard_contours(contours)
    img_data = partition_shards(shards)

    # We need to know the mappings of shards to settings
    shard_settings = [s[1] for s in shards]

    b64_partitions = []

    for img_partition in range(img_data.shape[0]):
        png_path = imgs_path_template.format(str(img_partition), 'png')
        b64_path = imgs_path_template.format(str(img_partition), 'txt')

        print(f'Writing {png_path}')

        # We could probably encode the png straight to base64 but it's
        #   good to store these PNGs as they show visually what's going
        #   on. Otherwise all the data is just nonsense base64.
        imageio.imwrite(png_path, img_data[img_partition])

        # We convert to base64 so all of the non-user data, including
        #   the PNG file of the shards, can be wrapped up in one JSON,
        #   for ease of updating everything at the same time. We could
        #   cache the individual PNGs instead with IndexedDB in the app,
        #   but this is easier in the app.
        b64_img_data = img_to_b64(png_path)
        b64_partitions.append(b64_img_data)

        with open(b64_path, 'w') as f:
            f.write(b64_img_data)

    # Put everything together
    non_user_data = {
        'tunes': cleaned_thesession_data,
        'aliases': gathered_aliases,
        'shard-to-settings': shard_settings,
        'shard-partitions': b64_partitions
    }

    print(f'Writing {non_user_data_path}')
    with open(non_user_data_path, 'w') as f:
        json.dump(non_user_data, f)


def clean_thesession_data(tune_data):
    # Convert types and discard redundant data
    for i, tune in enumerate(tune_data):
        del tune_data[i]['date']
        del tune_data[i]['username']
        tune_data[i]['tune'] = int(tune_data[i]['tune'])
        tune_data[i]['setting'] = int(tune_data[i]['setting'])

    return tune_data


def gather_aliases(aliases):
    # The aliases.json file is inefficiently structured for network
    #   distribution and we can condense it somewhat
    condensed_aliases = {}
    for alias in aliases:
        tid = alias['tune_id']

        if tid in condensed_aliases:
            condensed_aliases[tid]['aliases'].append(alias['alias'])
        else:
            alias['aliases'] = [alias['alias']]
            del alias['alias']

            if 'name' in alias:
                del alias['name']
            else:
                # https://github.com/adactio/TheSession-data/issues/12
                if tid == '9275':
                    alias['aliases'] = ['"Come Into The Town, My Fair Lady"']
                elif tid == '18917':
                    alias['aliases'] = ['"When I Saw My Bonny Lass To The Church Go"']
                else:
                    log.warning('Missing name field from first name entry.'
                                ' Alias might be broken.')
                    log.warning(alias)

            condensed_aliases[tid] = alias

    return sorted(condensed_aliases.values(), key=lambda a: int(a['tune_id']))


def generate_midi_contours(tune_data, midis_path):
    contours = []

    for setting in tqdm(tune_data,
                        desc='Converting ABC text to contour string'):
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

        midi_out_path = os.path.join(midis_path,
                                     '{}.midi'.format(setting['setting']))

        if not os.path.exists(midi_out_path):
            midi.abc_to_midi(abc, midi_out_path)

        midi_events = midi.midi_as_csv(midi_out_path)
        note_contour = midi.CSVMidiNoteReader(midi_events).to_midi_contour()

        contours.append((setting['setting'], note_contour))

    return contours


def shard_contours(contours):
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

    shard_size = ff_config.QUERY_SHARD_SIZE
    shards = collections.defaultdict(list)
    total_overlap = 0

    # shard: [setting_1, setting_2, setting_3,..., ]  (but likely only 2 or 3)
    for setting_id, contour in tqdm(contours, desc='Sharding contours'):
        if not contour:
            continue

        if len(contour) < shard_size:
            contour = list(contour) * (1 + shard_size // len(contour))
            contour = tuple(contour[:shard_size])

        num_shards = math.ceil(len(contour) / shard_size)
        overlapping_notes = num_shards * shard_size - len(contour)
        overlaps = partition_x_into_n(overlapping_notes, num_shards)
        total_overlap += overlapping_notes

        contour = 2 * contour
        next_s = 0
        for i in range(num_shards):
            shard = contour[next_s: next_s + shard_size]
            if len(shard) != ff_config.QUERY_SHARD_SIZE:
                raise RuntimeError(shard)

            shards[tuple(shard)].append(int(setting_id))
            next_s += shard_size
            next_s -= overlaps[i]

    # (Changes shards to a list for this to work)
    # x = len(shards)
    # y = len(set(shards))
    # print(x, y, x - y)
    # print('Extra efficiency from de-duplicating shards ', shard_size * (x - y))
    # print('Inefficiency from overlaps ', total_overlap)
    # > 133435 123375 10060
    # > Extra efficiency from de-duplicating shards 643840
    # > Inefficiency from overlaps 564268

    # Sort setting and remove any cases where the same shard occurs multiple
    #   times in a tune.
    for shard in shards:
        shards[shard] = sorted(list(set(shards[shard])))

    shards = list(sorted(shards.items(), key=lambda s: s[1][0]))

    return shards


def partition_shards(shards):
    shards_per_partition = (ff_config.QUERY_TEXTURE_EDGE_LENGTH ** 2
                            / ff_config.QUERY_SHARD_SIZE)
    shards_per_row = int(ff_config.QUERY_TEXTURE_EDGE_LENGTH
                         / ff_config.QUERY_SHARD_SIZE)
    num_partitions = math.ceil(len(shards) / shards_per_partition)
    num_padding_shards = num_partitions * shards_per_partition - len(shards)

    # The shards are stacked in vertical columns indexed
    #   [0, ff_config.QUERY_TEXTURE_EDGE_LENGTH - 1]
    #   Down the first column of the first image, due to the
    #   way the data is read back out of shaders in WebGL.
    shard_data = np.vstack([np.array(s[0], np.uint8) for s in shards])
    padding_data = np.repeat(np.zeros_like(shard_data[0])[np.newaxis, :],
                             num_padding_shards, axis=0)
    img_data = np.concatenate((shard_data, padding_data))
    img_data = img_data.reshape((-1, shards_per_row,
                                 ff_config.QUERY_TEXTURE_EDGE_LENGTH,
                                 ff_config.QUERY_SHARD_SIZE))
    img_data = np.transpose(img_data, (0, 2, 1, 3))
    img_data = np.reshape(img_data, (-1,
                                     ff_config.QUERY_TEXTURE_EDGE_LENGTH,
                                     ff_config.QUERY_TEXTURE_EDGE_LENGTH))

    return img_data


def img_to_b64(path):
    with open(path, 'rb') as f:
        b64_data = base64.b64encode(f.read())
        b64_img_src = f'data:image/png;base64,{b64_data.decode()}'
    return b64_img_src


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
                        default='./index-data',
                        help='Directory to contain the dataset files in')
    args = parser.parse_args()
    build_non_user_data(args.dir)
