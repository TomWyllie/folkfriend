"""
    Create a folder of abc-file tunes which have accompanying chords written in.
    Use thesession.org data dumps for obtaining the dataset of ABC files.
"""

import argparse
import csv
import glob
import os
import pathlib
import re

import requests
from tqdm import tqdm


def main(dataset_dir):
    tunes_path = os.path.join(dataset_dir, 'tunes.csv')
    abcs_path = os.path.join(dataset_dir, 'abcs')
    pathlib.Path(abcs_path).mkdir(parents=True, exist_ok=True)

    get_session_csv(tunes_path)

    files = glob.glob(os.path.join(abcs_path, '*'))
    for f in files:
        os.remove(f)

    with open(tunes_path, 'r') as f:
        for i, tune in tqdm(enumerate(csv.DictReader(f)), ascii=True):
            # Some tunes have multiple staves (like piano music) which are
            #   sometimes in the same cleff. This creates polyphonic melodies
            #   which for now is not something we want.
            if 'V:1' in tune['abc']:
                continue

            # We don't want songs
            if 'W:' in tune['abc'] or 'w:' in tune['abc']:
                continue

            # Does this tune have chords written in?
            if len(re.findall(r'"(?:[A-G]#?b?/)?[A-G]#?b?m?7?(?:dim)?"',
                              tune['abc'])) >= 8:
                abc_file_string = 'X:1\nT:\nM:{}\nK:{}\n{}'.format(
                    tune['meter'].strip(),
                    tune['mode'].strip(),
                    tune['abc'].replace('\\', ''))
                with open(os.path.join(abcs_path, '{}-{}.abc'.format(
                        tune['tune'],
                        tune['setting'])), 'w') as g:
                    g.write(abc_file_string)


def get_session_csv(tunes_path):
    session_tunes_url = 'https://raw.githubusercontent.com/adactio/TheSession-data/main/csv/tunes.csv'
    if not os.path.exists(tunes_path):
        print(f'Downloading from {session_tunes_url}...')
        r = requests.get(session_tunes_url, allow_redirects=True)
        with open(tunes_path, 'wb') as f:
            f.write(r.content)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir',
                        default=os.path.join(str(pathlib.Path.home()),
                                             'datasets/folkfriend'),
                        help='Directory to contain the dataset files in')
    args = parser.parse_args()
    main(args.dir)