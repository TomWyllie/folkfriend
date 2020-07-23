"""
    For each config file given, create an ABC file with the necessary
    instruments and synthesise the MIDI files with and without accompaniment.

    For the base MIDI file then run midicsv, read back in the csv, and create
    a pseudo-spectrogram binary mask for the CNN to train on. Save this as a
    png.

    For the accompanied MIDI file, synthesise a .wav file, mix in any specified
    background noise or other corruptions, take the EAC spectrogram and save
    the resulting png. Do a sanity check to make sure the 'input' png has the
    same dimensions as the binary mask png.

    Convert the .wav file to a heavily compressed .mp3 file in case we ever
    want to listen back to the data (although it should be able to be exactly
    recreated from the config file).
"""

import argparse
import json
import logging
import os
import pathlib
import subprocess
import timeit
from multiprocessing import Pool
import collections
from folkfriend import ff_config
from folkfriend.data.dataset import ConfigError, DatasetEntry, DatasetSubDir

import download_abcs
import random_config

logging.basicConfig(level=logging.DEBUG,
                    format='[%(name)s:%(lineno)s] %(message)s')
log = logging.getLogger(os.path.basename(__file__))


def generate(config_files):
    log.info(f'Beginning processing {len(config_files)} files')
    start_time = timeit.default_timer()

    # Parallel
    with Pool() as p:
        p.map(create_entry_wrapper, config_files)

    # Single (useful for debugging)
    # for config in config_files:
    #     create_entry_wrapper(config)

    log.info('Done in {:.3f} seconds'.format(
        timeit.default_timer() - start_time))

    build_meta_files(config_files)

    # https://github.com/kkroening/ffmpeg-python/issues/108
    subprocess.run(['stty', 'echo'])  # This fixes terminal being broken


def create_entry_wrapper(config):
    # === Create this dataset entry ===
    log.info(f"Processing config {config['index']}")
    # noinspection PyBroadException
    try:
        DatasetEntry(config=config,
                     dirs=dirs,
                     thesession_data=thesession_data,
                     retain_audio=retain_audio)
    except ConfigError as e:
        log.warning(e)
    except Exception as e:
        log.exception(e)


def build_meta_files(config_files):
    # RNN requires train.txt/val.txt in format <PATH> <LABEL>
    #   as well as table.txt.
    annotations = []
    for config in config_files:
        index = config['index']

        label_path = label_dir.chunk_path(index, '{:d}.txt')
        png_path = png_dir.chunk_path(index, '{:d}d.png')

        if not os.path.exists(png_path):
            continue

        try:
            with open(label_path, 'r') as f:
                label_text = f.read()
        except FileNotFoundError:
            continue

        # Use local path
        # TODO tidy this up a bit
        dir_string_no_slash = args.dir
        if args.dir.endswith('/'):
            dir_string_no_slash = dir_string_no_slash[:-1]
        annotations.append('{} {}\n'.format(png_path.replace(
            dir_string_no_slash, '.'), label_text))

    val_index = int(val_fraction * len(annotations))

    train = os.path.join(args.dir, 'train.txt')
    val = os.path.join(args.dir, 'val.txt')
    table = os.path.join(args.dir, 'table.txt')

    with open(train, 'w') as f:
        f.writelines(annotations[:-val_index])

    with open(val, 'w') as f:
        f.writelines(annotations[-val_index:])

    with open(table, 'w') as f:
        f.write('\n'.join(ff_config.MIDI_MAP))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir',
                        default=ff_config.DEFAULT_DS_DIR,
                        help='Directory to contain the dataset files in')
    parser.add_argument('--no-audio', action='store_true')
    parser.add_argument('--num', default=100, help='Number of entries in dataset', type=int)
    parser.add_argument('-vf', '--val-fraction', default=0.1, type=float,
                        help='Use this fraction of the dataset as validation'
                             'data when training.')
    args = parser.parse_args()

    if not 0 <= args.val_fraction < 1:
        raise ValueError('Validation Fraction must belong to [0, 1)')

    pathlib.Path(args.dir).mkdir(parents=True, exist_ok=True)

    val_fraction = args.val_fraction
    retain_audio = not args.no_audio

    download_abcs.download_abcs(args.dir)
    random_config.generate_random_config(args.dir, args.num)

    with open(os.path.join(args.dir, 'configs.json')) as config_file:
        configs = json.load(config_file)
    DatasetSubDir.DS_SIZE = len(configs)
    DatasetSubDir.DS_DIR = args.dir

    with open(os.path.join(args.dir, 'thesession-data.json')) as f_session:
        thesession_data = json.load(f_session)

    midi_dir = DatasetSubDir('midis', purge=True)
    audio_dir = DatasetSubDir('audio', purge=True)
    png_dir = DatasetSubDir('pngs', purge=True)
    label_dir = DatasetSubDir('labels', purge=True)

    Dirs = collections.namedtuple('dirs', field_names=[
        'midi_dir', 'audio_dir', 'png_dir', 'label_dir'])
    dirs = Dirs(midi_dir, audio_dir, png_dir, label_dir)

    generate(configs)
