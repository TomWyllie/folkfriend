import argparse

import csv

def main(queries_path, labels_path):

    with open(queries_path) as f:
        queries = list(csv.reader(f))
    
    labels = {}
    with open(labels_path) as f:
        labels_csv = list(csv.DictReader(f))
        labels = {row['rel_path']: row['tune_id'] for row in labels_csv}

    print(f'rel_path,rank')

    for audio_slice_record in queries:

        # Recover the original audio file path from the path of the slice
        audio_slice_path = audio_slice_record[0]
        original_audio_path = audio_slice_path.replace('slices/', '')
        original_audio_path = original_audio_path[:-8] + '.mp3'
        
        assert original_audio_path in labels

        # 0 = top rank, i.e. best guess was ground truth.
        rank = 0
        ground_truth = labels[original_audio_path]
        query_results = audio_slice_record[1:]

        for query_result in query_results:
            if query_result == ground_truth:
                break
            rank += 1

        print(f'{audio_slice_path},{rank}')

    



if __name__ == '__main__':
    arg_parser = argparse.ArgumentParser()
    arg_parser.add_argument(
        'queries_path',
        help='Path to CSV output of the folkfriend `query` command (from the'
        ' rust executable)')
    arg_parser.add_argument(
        'labels_path'
    )
    args = arg_parser.parse_args()
    main(args.queries_path, args.labels_path)
