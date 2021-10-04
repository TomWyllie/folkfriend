"""Open slices.csv and add labels to each row, using recordings.csv"""

import argparse
import csv
import os
import re

import csv_headers


def main(dataset):
    slices_path = os.path.join(dataset, 'slices.csv')
    with open(slices_path, 'r') as f:
        slices = list(csv.DictReader(f))

    recordings_path = os.path.join(dataset, 'recordings.csv')
    with open(recordings_path, 'r') as f:
        recordings = list(csv.DictReader(f))

    audio_id_to_recording = {}
    for recording in recordings:
        audio_id = recording['rel_path'].replace('.mp3', '')
        audio_id_to_recording[audio_id] = recording

    output_rows = []

    for slice in slices:
        audio_id = slice['rel_path'].replace('slices/' , '')
        audio_id = re.sub(r'_\d{3}\.wav', '', audio_id)
        recording = audio_id_to_recording[audio_id]
        recording['rel_path'] = slice['rel_path']
        output_rows.append({**recording})

    labeled_slices_path = os.path.join(dataset, 'labeled_slices.csv')
    with open(labeled_slices_path, 'w') as f:
        writer = csv.DictWriter(f, csv_headers.LABELED_SLICES)
        writer.writeheader()
        writer.writerows(output_rows)

    print(f'Wrote {labeled_slices_path}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', default='/home/tom/datasets/tiny-folkfriend-evaluation-dataset')
    args = parser.parse_args()
    main(args.dataset)
