import argparse
import csv
import json
import os
import csv_headers

from folkfriend.decoder import sig_to_query
from scipy.io import wavfile
from tqdm.contrib.concurrent import process_map


def main(dataset):
    slices_path = os.path.join(dataset, 'labeled_slices.csv')

    with open(slices_path) as f:
        slices = list(csv.DictReader(f))

        assert all(list(slice.keys()) == csv_headers.LABELED_SLICES
                   for slice in slices)
        multiproc_input = [(dataset, slice) for slice in slices]

    transcribed_slices = process_map(transcribe_file, multiproc_input,
                                 desc='Transcribing Audio Files', chunksize=1)

    transcriptions_path = os.path.join(dataset, 'transcriptions.csv')

    with open(transcriptions_path, 'w') as f:
        csv_writer = csv.DictWriter(f, csv_headers.TRANSCRIPTIONS)
        csv_writer.writeheader()
        csv_writer.writerows(transcribed_slices)

    print(f'Wrote {transcriptions_path}')


def transcribe_file(args):
    dataset, slice = args
    abs_path = os.path.join(dataset, slice['rel_path'])
    sample_rate, signal = wavfile.read(abs_path)
    transcription = sig_to_query.transcribe(signal, sample_rate)
    slice['transcription'] = transcription
    return slice


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument(
        '--dataset', default='/home/tom/datasets/tiny-folkfriend-evaluation-dataset')
    args = parser.parse_args()
    main(args.dataset)
