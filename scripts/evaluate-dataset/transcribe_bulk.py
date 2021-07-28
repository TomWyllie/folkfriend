import argparse
import csv
import json
import os

from folkfriend.decoder import sig_to_query
from scipy.io import wavfile
from tqdm.contrib.concurrent import process_map


def main(dataset):
    slices_path = os.path.join(dataset, 'slices.csv')

    with open(slices_path) as f:
        slices = [(dataset, s['path']) for s in csv.DictReader(f)]

    transcriptions = process_map(transcribe_file, slices,
        desc='Transcribing Audio Files', chunksize=1)
 
    transcriptions_path = os.path.join(dataset, 'transcriptions.json')

    with open(transcriptions_path, 'w') as f:
        json.dump(transcriptions, f)

    print(f'Wrote {transcriptions_path}')

def transcribe_file(args):
    dataset, local_path = args
    abs_path = os.path.join(dataset, local_path)
    sample_rate, signal = wavfile.read(abs_path)
    query = sig_to_query.sig_to_query(signal, sample_rate)
    return query, local_path


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dataset', default='/home/tom/datasets/tiny-folkfriend-evaluation-dataset')
    args = parser.parse_args()
    main(args.dataset)
