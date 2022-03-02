import json
import numpy as np
from tqdm import tqdm
import matplotlib.pyplot as plt
from pprint import pprint

from key_converter import get_mode_as_abc, detect_key_and_mode

keys_confusion_matrix = np.zeros((12, 12), dtype=np.int64)
modes_confusion_matrix = np.zeros((4, 4), dtype=np.int64)

KEYS = [
    'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'
]
MODES = ['maj', 'mix', 'dor', 'min']

KEYS_LOOKUP = {k: i for (i, k) in enumerate(KEYS)}
MODES_LOOKUP = {m: i for (i, m) in enumerate(MODES)}


def main():
    in_path = '/home/tom/.folkfriend/folkfriend-non-user-data.json'

    with open(in_path, 'r') as f:
        ff_nud = json.load(f)

    ctms = ContourToMIDISeq()

    correct_predictions = 0
    total_predictions = 0

    for tune in tqdm(ff_nud['settings'].values()):
        contour = tune['contour']
        key = tune['mode'][0]
        mode = tune['mode'][1:4]

        midi_seq = ctms.convert(contour)

        pred_key, pred_mode = detect_key_and_mode(midi_seq)
        
        pred_key = str(pred_key)
        pred_mode = get_mode_as_abc(pred_mode)

        correct_key = pred_key == key
        correct_mode = pred_mode == mode

        if correct_key and correct_mode:
            correct_predictions += 1

        if not correct_key:
            keys_confusion_matrix[KEYS_LOOKUP[key],
                                  KEYS_LOOKUP[pred_key]] += 1

        if not correct_mode:
            modes_confusion_matrix[MODES_LOOKUP[mode],
                                   MODES_LOOKUP[pred_mode]] += 1

        total_predictions += 1

    print(f'{correct_predictions} / {total_predictions} correct ({100*correct_predictions/total_predictions}%).')

    print(keys_confusion_matrix)
    print(modes_confusion_matrix)


class ContourToMIDISeq:
    def __init__(self):
        midi_to_query_char = [
            'a', 'b', 'c', 'd', 'e',
            'f', 'g', 'h', 'i', 'j',
            'k', 'l', 'm', 'n', 'o',
            'p', 'q', 'r', 's', 't',
            'u', 'v', 'w', 'x', 'y',
            'z', 'A', 'B', 'C', 'D',
            'E', 'F', 'G', 'H', 'I',
            'J', 'K', 'L', 'M', 'N',
            'O', 'P', 'Q', 'R', 'S',
            'T', 'U', 'V'
        ]
        self.query_char_to_midi = {
            c: 48 + i for (i, c) in enumerate(midi_to_query_char)}

    def convert(self, contour):
        return np.array([self.query_char_to_midi[c] for c in contour])


if __name__ == '__main__':
    main()
