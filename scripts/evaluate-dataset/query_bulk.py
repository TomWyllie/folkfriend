import argparse
import csv
import json
import os
import re

from folkfriend.query import query_engine
from tqdm import tqdm
from tqdm.contrib.concurrent import process_map


def main(dataset, index):

    transcriptions_path = os.path.join(dataset, 'transcriptions.json')
    try:
        with open(transcriptions_path, 'r') as f:
            transcriptions = json.load(f)
    except FileNotFoundError as e:
        print(f'Cannot find file {transcriptions_path}.')
        print('Have you run transcribe_bulk.py on this dataset?')
        return

    recordings_path = os.path.join(dataset, 'recordings.csv')
    with open(recordings_path, 'r') as f:
        recordings = list(csv.DictReader(f))

    try:
        with open(index, 'r') as f:
            index_data = json.load(f)
    except FileNotFoundError as e:
        print(f'Cannot find file {index}.')
        print(f'Have you run build_non_user_data.py?')

    settings_to_tunes = {}
    for tune in index_data['tunes']:
        settings_to_tunes[tune['setting_id']] = tune['tune_id']

    audio_to_tunes = {}
    for recording in recordings:
        audio_id = recording['path'].replace('.mp3', '')
        audio_to_tunes[audio_id] = recording['thesession-id']

    contour_data = index_data['contours']
    qe = query_engine.QueryEngine(contour_data)

    ranked_slices = []

    for query, slice_path in tqdm(transcriptions, desc='Running queries'):
        matches = qe.run_query(query)

        tune_ids = [settings_to_tunes[m[0]] for m in matches]
        audio_id = slice_path.replace('slices/' , '')
        audio_id = re.sub(r'_\d{3}\.wav', '', audio_id)
        correct_tune_id = audio_to_tunes[audio_id]

        if correct_tune_id not in tune_ids:
            rank = len(tune_ids)
        else:
            rank = tune_ids.index(correct_tune_id)

        row = {'path': slice_path, 'rank': rank}
        print(row)
        ranked_slices.append(row)

    ranked_path = os.path.join(dataset, 'ranked.csv')
    with open(ranked_path, 'w') as f:
        writer = csv.DictWriter(f, ['path', 'rank'])
        writer.writeheader()
        writer.writerows(ranked_slices)

    print(f'Wrote {ranked_path}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--dataset', default='/home/tom/datasets/tiny-folkfriend-evaluation-dataset')
    parser.add_argument(
        '--index',
        default='../index-builder/index-data/folkfriend-non-user-data.json')
    args = parser.parse_args()
    main(args.dataset, args.index)
