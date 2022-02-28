from enum import IntEnum

AbcVocab = dict                 # MidiPitch: AbcNote
MusicalKeySignature = dict      # MidiPitch: AbcNote
MidiPitch = int

class MusicalMode(IntEnum):
    # This lookup says: for each mode, if a note X is such that starting on X
    #   takes the scale back to a major mode, then how many semitones above the 
    #   first note of the scale is note X.
    IONIAN = 0
    DORIAN = 2
    PHRYGIAN = 4
    LYDIAN = 5
    MIXOLYDIAN = 7
    AEOLIAN = 9
    LOCRIAN = 11

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

if __name__ == '__main__':
    print(MusicalMode.DORIAN)