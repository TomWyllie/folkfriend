"""
    Create a folder of abc-file tunes which have accompanying chords written in.
    Use thesession.org data dumps for obtaining the dataset of ABC files.
"""

import argparse
import json
import os
import re
import shutil
import tempfile

import requests
from folkfriend import ff_config
from tqdm import tqdm


def download_abcs(ds_dir):
    tunes_path = os.path.join(ds_dir, 'thesession-data.json')

    download_thesession_data(tunes_path)

    with open(tunes_path, 'r') as f:
        tunes = json.load(f)
        indices_with_chords = []

        for i, tune in tqdm(enumerate(tunes), ascii=True,
                            desc='Finding which tunes have chords written in '
                                 'to generate accompaniment'):
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
                indices_with_chords.append(i)

    tunes_with_chords_path = os.path.join(ds_dir, 'chords.json')
    with open(tunes_with_chords_path, 'w') as f:
        json.dump(indices_with_chords, f)


def download_thesession_data(tunes_path):
    if not os.path.exists(tunes_path):
        # In case we are running trial and error experiments we might be
        #   deleting and remaking many datasets in a short period.
        td = tempfile.gettempdir()
        temp_tunes_path = os.path.join(td, os.path.basename(tunes_path))
        if os.path.exists(temp_tunes_path):
            print(f'Found cached {temp_tunes_path}...')
            shutil.copy(temp_tunes_path, tunes_path)
            return

            # Otherwise download it fresh from the github repository.
        print(f'Downloading from {ff_config.THESESSION_DATA_URL}...')
        r = requests.get(ff_config.THESESSION_DATA_URL)
        with open(tunes_path, 'wb') as f:
            f.write(r.content)

        # Store to temp in case we need it later
        shutil.copy(tunes_path, temp_tunes_path)

