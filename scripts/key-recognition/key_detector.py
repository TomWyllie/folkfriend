from scipy.linalg import circulant
import numpy as np

MODE_SHAPES = {'dorian': [
    0.25061224, 0.00055867, 0.14169932, 0.08923983, 0.00325907,
    0.12707732, 0.00095709, 0.17060512, 0.00217626, 0.04171721,
    0.16928502, 0.00281284],
    'major': [
    0.23721947, 0.00089920, 0.14192422, 0.00117854, 0.17147175,
    0.07980328, 0.00336021, 0.18184678, 0.00104605, 0.10996197,
    0.00410795, 0.06718059],
    'minor': [
    0.23153994, 0.00116728, 0.12028706, 0.15227597, 0.00250881,
    0.13079765, 0.00221498, 0.18448871, 0.04365511, 0.00570442,
    0.11622747, 0.00913261],
    'mixolydian': [
    0.24891100, 0.00058114, 0.11803482, 0.00410037, 0.1079509,
    0.13229921, 0.00053683, 0.19185175, 0.00106514, 0.07561318,
    0.11076458, 0.00829107]}

KEYS = [
    'C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'
]

class KeyDetector():
    def __init__(self):
        self.circulant_matrices = [(mode, circulant(shape))
                                   for (mode, shape) in MODE_SHAPES.items()]

    def detect_key(self, midi_seq):
        midi_seq_shape = np.zeros(12)
        for midi in midi_seq:
            midi_seq_shape[midi % 12] += 1
        midi_seq_shape /= np.sum(midi_seq_shape)

        best_keys_per_mode = []

        for mode, circ_mat in self.circulant_matrices:
            scores = midi_seq_shape @ circ_mat
            key = np.argmax(scores)
            hi_score = scores[key]
            best_keys_per_mode.append((KEYS[key], mode, hi_score))

        return max(best_keys_per_mode, key=lambda x: x[2])[:2]


def main():
    kd = KeyDetector()

    tune = [62, 67, 71, 67, 69, 71, 72, 76, 76, 76, 74, 74, 62, 67, 71, 74, 69, 72, 71, 67, 67, 67, 67, 67, 62, 67, 71, 67, 69, 71, 72, 76, 76, 76, 74, 74, 62, 67, 71, 74, 69, 72, 71, 67, 67, 67, 67,
            67, 74, 74, 71, 74, 79, 78, 79, 76, 76, 76, 72, 72, 71, 69, 71, 72, 76, 74, 74, 67, 67, 67, 66, 66, 62, 67, 71, 67, 69, 71, 72, 76, 76, 76, 74, 74, 62, 67, 71, 74, 69, 72, 71, 67, 67, 67, 67, 67]

    detected_key = kd.detect_key(tune)
    print(detected_key)

if __name__ == '__main__':
    main()
