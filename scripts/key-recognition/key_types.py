AbcVocab = dict                 # MidiPitch: AbcNote
MusicalKeySignature = dict      # MidiPitch: AbcNote
MidiPitch = int

class MusicalKey:
    def __init__(self, letter: str, modifier: int):
        self.letter: str = letter
        self.modifier: int = modifier

    def __repr__(self):
        modifier_str = {
            -1: 'b',
            0: '',
            1: '#'
        }[self.modifier]
        return f'{self.letter.upper()}{modifier_str}'

def get_relative_midi(key: MusicalKey) -> MidiPitch:
    rel_midi = 69 + key.modifier + {
        'A': 0,
        'B': 2,
        'C': 3,
        'D': 5,
        'E': 7,
        'F': 8,
        'G': 10
    }[key.letter.upper()]
    return rel_midi % 12
