import argparse
import collections
import json
import logging
import os
import pathlib
import re
import shutil
import tempfile

import requests
from folkfriend import ff_config
from folkfriend.data import midi
from tqdm.contrib.concurrent import process_map

logging.basicConfig(level=logging.DEBUG,
                    format='[%(name)s:%(lineno)s] %(message)s')
log = logging.getLogger(os.path.basename(__file__))

STOP_WORDS = {"a", "an", "the", "at", "by", "for", "in", "of", "on",
              "to", "up", "and", "as", "but", "or", "nor"}
NON_WORD_CHARS = re.compile('[^a-zA-Z ]')


def build_non_user_data(p_dir):

    # Set up paths and directories

    midis_dir = os.path.join(p_dir, 'midis')
    tunes_path = os.path.join(p_dir, 'thesession-data.json')
    aliases_path = os.path.join(p_dir, 'thesession-aliases.json')
    non_user_data_path = os.path.join(p_dir, 'folkfriend-non-user-data.json')

    pathlib.Path(p_dir).mkdir(parents=True, exist_ok=True)
    pathlib.Path(midis_dir).mkdir(parents=True, exist_ok=True)

    # Download raw thesession.org data dumps from github

    download_thesession_data(tunes_path)
    with open(tunes_path, 'r') as f:
        thesession_data = json.load(f)

    download_thesession_aliases(aliases_path)
    with open(aliases_path, 'r') as f:
        thesession_aliases = json.load(f)

    # We convert the ABC files to a form more directly usable by a search
    #   engine. ABC files contain non-trivial syntax that must be properly
    #   parsed and it is unsuitable to require this running on the edge
    #   before first use, so we do this once and distribute as part of the
    #   non-user data file.

    # But - we would still like the original ABC string as it is used to
    #   render the sheet music (and going back from our queryable
    #   representation into ABC is even harder than the reverse as that's
    #   a non-unique mapping. However there's some other information in the
    #   JSON file from thesession.org's GitHub that isn't useful for us,
    #   which we now get rid of.

    log.info('Creating cleaned version of input data file')
    cleaned_thesession_data = clean_thesession_data(thesession_data)

    log.info('Gathering tune name aliases')
    gathered_aliases = gather_aliases(thesession_aliases)

    multiprocessing_input = [(s, midis_dir) for s in thesession_data]

    # The heavy lifting is done here
    contours = process_map(
        generate_midi_contour,
        multiprocessing_input,
        desc='Converting ABC text to contour string',
        chunksize=8)

    # Key on setting_id
    contour_data = {s_id: cont for s_id, cont in contours}

    # Put everything together
    non_user_data = {
        'tunes': cleaned_thesession_data,
        'aliases': gathered_aliases,
        'contours': contour_data,
    }

    print(f'Writing {non_user_data_path}')
    with open(non_user_data_path, 'w') as f:
        json.dump(non_user_data, f)


def clean_thesession_data(tune_data):
    # Convert types and discard redundant data
    for i, _ in enumerate(tune_data):
        del tune_data[i]['date']
        del tune_data[i]['username']

    return tune_data


def gather_aliases(alias_records):
    # The aliases.json file is inefficiently structured for network
    #   distribution and we can condense it somewhat
    aliases = collections.defaultdict(list)
    for alias_record in sorted(alias_records, key=lambda r: int(r['tune_id'])):
        tid = alias_record['tune_id']
        alias = alias_record['alias']
        aliases[tid].append(alias)

    for tid in aliases:
        aliases[tid] = deduplicate_aliases(aliases[tid])

    return aliases


def deduplicate_aliases(aliases):

    seen_aliases = set()
    deduped_aliases = []

    # Remove based on minor differences in punctuation / stopwords
    for alias in aliases:
        cleaned_alias = clean_alias(alias)
        if cleaned_alias not in seen_aliases:
            seen_aliases.add(cleaned_alias)
            deduped_aliases.append((cleaned_alias, alias))

    deduped_aliases = sorted(deduped_aliases, key=lambda c: len(c[0]))

    # Remove subsets. Requires sorting by length.
    deduped_aliases_no_subsets = []
    for i, (cleaned, alias) in enumerate(deduped_aliases):
        is_subset = (cleaned < c for (c, _) in deduped_aliases[i:])
        if not any(is_subset):
            deduped_aliases_no_subsets.append(alias)

    # Back to alphabetical at the end
    return sorted(deduped_aliases_no_subsets)


def clean_alias(alias):
    # Remove redundancy from each string
    alias = alias.lower()
    alias = NON_WORD_CHARS.sub('', alias)
    alias = alias.split()
    alias = (w for w in alias if w and w not in STOP_WORDS)
    alias = ((w[:-1] if w.endswith('s') else w)
             for w in alias)  # Ignore plurals

    # This American spelling pops up a lot. Retain the British spelling
    #   for alias purposes.
    alias = ((w if not w == 'favorite' else 'favourite') for w in alias)
    return frozenset(sorted(alias))


def generate_midi_contour(args):
    setting, midis_path = args

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
                                 f'{setting["setting_id"]}.midi')

    if not os.path.exists(midi_out_path):
        midi.abc_to_midi(abc, midi_out_path)

    midi_events = midi.midi_as_csv(midi_out_path)
    note_contour = midi.CSVMidiNoteReader(midi_events).to_midi_contour()

    return setting['setting_id'], note_contour


def download_thesession_aliases(aliases_path):
    aliases_url = ff_config.THESESSION_DATA_URL_.replace(
        'tunes.json', 'aliases.json'
    )
    download_thesession_data(aliases_path, aliases_url)


def download_thesession_data(tunes_path,
                             data_url=ff_config.THESESSION_DATA_URL_):
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
        print(f'Downloading from {data_url}...')
        r = requests.get(data_url)
        with open(tunes_path, 'wb') as f:
            f.write(r.content)

        # Store to temp in case we need it later
        shutil.copy(tunes_path, temp_tunes_path)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir',
                        default='./index-data',
                        help='Directory to contain the dataset files in')
    args = parser.parse_args()
    build_non_user_data(args.dir)
