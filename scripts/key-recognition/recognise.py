import json
import numpy as np
from tqdm import tqdm
import matplotlib.pyplot as plt
from pprint import pprint

MODES = ['major', 'mixolydian', 'dorian', 'minor']
KEY_OFFSETS = {
    'A': 0,
    'B': 2,
    'C': 3,
    'D': 5,
    'E': 7,
    'F': 8,
    'G': 10
}


def main():
    in_path = '/home/tom/.folkfriend/folkfriend-non-user-data.json'

    with open(in_path, 'r') as f:
        ff_nud = json.load(f)

    ctms = ContourToMIDISeq()

    mode_shapes = {mode: np.zeros(12) for mode in MODES}

    for tune in tqdm(ff_nud['settings'].values()):
        contour = tune['contour']
        key = tune['mode'][0]
        key_offset = KEY_OFFSETS[key]
        mode = tune['mode'][1:]

        midi_seq = ctms.convert(contour)

        print(list(midi_seq))

        # subtract 9 because A4 = MIDI 69 and 5 x 12 + 9 = 69
        midi_seq -= (9 + key_offset)
        midi_seq %= 12

        for midi in midi_seq:
            mode_shapes[mode][midi] += 1

    plt.figure(figsize=(10, 8))

    for i, mode in enumerate(mode_shapes):
        mode_shapes[mode] /= np.sum(mode_shapes[mode])

        plt.subplot(len(mode_shapes), 1, 1+i)
        plt.title(mode)
        plt.bar(range(12), mode_shapes[mode])

    plt.show()

    pprint(mode_shapes)


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
