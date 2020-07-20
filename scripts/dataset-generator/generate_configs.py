"""
    Generate the required config files which define how each .png will be
    generated.
"""

import argparse
import glob
import json
import os
import pathlib
import random


def main(dataset_dir, num):
    """
        Instruments in the FolkFriend soundfont file are:

        Bank:Instrument Description
        000:000 Grand Piano
        000:001 Violin
        000:002 Accordion
        000:003 Flute
        000:004 Recorder
        000:005 Banjo
        000:006 Mandolin
        000:007 Clarinet
        000:008 Oboe
        000:009 Pan Flute
        000:010 Harp
        000:040 Nylon String Guitar
        000:041 Steel String Guitar
        000:042 Jazz Guitar
        000:043 Clean Guitar
        000:044 Palm Muted Guitar
        000:045 Distortion Guitar
        000:046 Overdrive Guitar
        000:047 Acoustic Bass
        000:048 Fingered Bass
        000:049 Picked Bass
    """

    # Relative probabilities of sampling different instruments for melody
    melody_probs = {
        0: 1.,
        1: 10.,
        2: 8.,
        3: 3.,
        4: 3.,  # Recorder ~= Whistle (no good tin whistle sound-font)
        5: 1.0,
        6: 1.0,
        7: 0.3,
        8: 0.3,
        9: 0.3,
        10: 0.5,
        40: 1.,
    }

    chord_probs = {
        0: 10.,
        2: 10.,
        6: 1.,
        10: 2.,
        40: 10.,
        41: 10.,
        42: 3.,
        43: 3.,
        44: 2.,
        45: 1.,
        46: 1.,
        47: 1.5,
        48: 1.5,
        49: 1.5,
    }

    melodies = random.choices(list(melody_probs.keys()),
                              weights=melody_probs.values(), k=num)
    chords = random.choices(list(chord_probs.keys()),
                            weights=chord_probs.values(), k=num)

    abcs_dir = os.path.join(dataset_dir, 'abcs')

    if not os.path.isdir(abcs_dir):
        raise RuntimeError('Could not find path {}. Please ensure that you '
                           'have run the extract_chorded_abcs.py script before'
                           'trying to generate configs.'.format(abcs_dir))

    abc_files = list(os.listdir(abcs_dir))

    tune_paths = random.choices(abc_files, k=num)
    configs = []

    # TODO lots of other parameters should go into these files
    # TODO percussive accompaniments
    for i, (tune_path, melody, chord) in enumerate(
            zip(tune_paths, melodies, chords)):
        config = {
            'index': i,
            'tune': os.path.join(abcs_dir, tune_path),
            'melody': melody,
            'chord': chord,
            'tempo': get_random_tempo(),
            # We add a random transposition to reduce any key bias, and to
            #   improve the melodic range of the model.
            'transpose': random.choice(range(-12, 11)),
            'chord_octave_shift': random.choice((0, 1))
        }
        configs.append(config)

    with open(os.path.join(dataset_dir, 'configs.json'), 'w') as f:
        json.dump(configs, f)
    print(f'Generated {num} config files to configs.json')


def get_random_tempo():
    if random.random() > 0.80:
        return random.choice(range(50, 100))
    else:
        return random.choice(range(100, 230))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir',
                        default=os.path.join(str(pathlib.Path.home()),
                                             'datasets/folkfriend'),
                        help='Directory to contain the dataset files in')
    parser.add_argument('--num', default=100, help='Number of config files to'
                                                   'generate',
                        type=int)
    args = parser.parse_args()
    main(args.dir, args.num)
