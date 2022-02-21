import re
from pprint import pprint

# This lookup says: for each mode, if a note X is such that starting on X
#   takes this back to a major scale, then how many semitones above the first
#   note of the scale is note X.
#   Relevant: https://abcnotation.com/wiki/abc:standard:v2.1#kkey
MODES_RELATIVE_MAJOR_TONIC = {
    'ionian': 0,
    'ion': 0,
    'major': 0,
    'maj': 0,
    '': 0,

    'dorian': 2,
    'dor': 2,

    'phrygian': 4,
    'phr': 4,

    'lydian': 5,
    'lyd': 5,

    'mixolydian': 7,
    'mix': 7,

    'aeolian': 9,
    'aeo': 9,
    'minor': 9,
    'min': 9,
    'm': 9,

    'locrian': 11,
    'loc': 11
}

OFFSETS_BY_KEY = {
    'A': 0,
    'B': 2,
    'C': 3,
    'D': 5,
    'E': 7,
    'F': 8,
    'G': 10
}

CIRCLE_OF_FIFTHS = list('FCGDAEB')


class Key:
    def __init__(self, letter: str, modifier: int):
        self.letter: str = letter
        self.modifier: int = modifier
        self.key_offset: int = OFFSETS_BY_KEY[letter]
        self.key_sig = self.get_compound_major_key_signature()

    def __repr__(self):
        modifier_str = ''
        if self.modifier > 0:
            modifier_str = self.modifier * '#'
        elif self.modifier < 0:
            modifier_str = abs(self.modifier) * 'b'
        return f'{self.letter}{modifier_str}'

    def get_compound_major_key_signature(self):
        key_sig = Key.get_simple_major_key_signature(self.letter)
        for letter in key_sig:
            key_sig[letter] += self.modifier
        return key_sig

    @staticmethod
    def get_simple_major_key_signature(letter):
        base_key_sig = {
            'F': 0,
            'C': 0,
            'G': 0,
            'D': 0,
            'A': 0,
            'E': 0,
            'B': -1,
        }

        try:
            num_steps_from_f = CIRCLE_OF_FIFTHS.index(letter)
        except ValueError:
            raise RuntimeError(
                f'Invalid simple key "{letter}". No sharps or flats are allowed.')

        modifier_ptr = 6

        for _ in range(num_steps_from_f):
            key_to_modify = CIRCLE_OF_FIFTHS[modifier_ptr % 7]
            base_key_sig[key_to_modify] += 1
            modifier_ptr += 1

        return base_key_sig

    def relative_midi(self):
        return (69 + OFFSETS_BY_KEY[self.letter] + self.modifier) % 12


class AbcNote:
    def __init__(self, letter: str, modifier: int, octave: int):
        self.letter: str = letter
        self.modifier: int = modifier
        self.octave: int = octave

    def __repr__(self):
        modifier_str = '='
        if self.modifier > 0:
            modifier_str = self.modifier * '^'
        elif self.modifier < 0:
            modifier_str = abs(self.modifier) * '_'

        lowercase = self.octave >= 5
        abc_letter = self.letter.lower() if lowercase else self.letter.upper()

        if self.octave >= 6:
            abc_letter += "'" * (self.octave - 5)
        elif self.octave <= 3:
            abc_letter += ',' * (4 - self.octave)

        return f'{modifier_str}{abc_letter}'

KEYS_BY_OFFSET = {
    0: Key('A', 0),
    1: Key('B', -1),
    2: Key('B', 0),
    3: Key('C', 0),
    4: Key('C', 1),
    5: Key('D', 0),
    6: Key('E', -1),
    7: Key('E', 0),
    8: Key('F', 0),
    9: Key('F', 1),
    10: Key('G', 0),
    11: Key('A', -1),
}


# For a major scale, do we prefer to raise or lower a note in the scale
#   to produce an accidental. This structure is generated based on the
#   proximity of those notes to the portion of the circle of fifths that
#   contains the notes of that scale.
#   See https://music.stackexchange.com/a/85848 ("Approach #3")
MAJOR_SCALE_NOTES = 'ABCDEFG'
MAJOR_SCALE_MODIFIERS = [
    (0, 0),
    (0, 1),
    (1, 0),
    (2, -1),
    (2, 0),
    (3, 0),
    (3, 1),
    (4, 0),
    (4, 1),
    (5, 0),
    (6, -1),
    (6, 0),
]


key_mode_parser = re.compile(
    r'^(?P<key>[a-g])(?P<key_modifier>#?b?) ?(?P<mode>\w*)$', re.IGNORECASE)


class KeyedMode:
    def __init__(self, keyed_mode):
        self.keyed_mode = keyed_mode.strip()
        self.rel_major_key = self.parse_keyed_mode(self.keyed_mode)

    def parse_keyed_mode(self, keyed_mode):
        try:
            match = key_mode_parser.match(keyed_mode.lower())
            assert match is not None
            groups = match.groupdict()
            assert groups['mode'] in MODES_RELATIVE_MAJOR_TONIC
        except AssertionError:
            raise RuntimeError(f'Invalid keyed mode "{keyed_mode}"')

        base_key = OFFSETS_BY_KEY[groups['key'].upper()]

        if groups['key_modifier'] == '#':
            base_key += 1
        elif groups['key_modifier'] == 'b':
            base_key -= 1

        rel_major_key_offset = base_key - \
            MODES_RELATIVE_MAJOR_TONIC[groups['mode']]
        rel_major_key_offset %= 12
        return KEYS_BY_OFFSET[rel_major_key_offset]


def get_midi_to_abc_note(rel_major_key):
    chromatic_scale = []
    notes_offset = MAJOR_SCALE_NOTES.index(rel_major_key.letter)

    # This is important. It defines how we choose between saying, for example,
    #   that something is an A# or a Bb. Again see:
    #   https://music.stackexchange.com/a/85848 ("Approach #3")
    # This leads to some interesting results. For example, in the key of
    #   F# major, we are "closer" (in steps in the circle of fifths) to a key
    #   containing F## (i.e., G# major) than we are to any key containing a G
    #   natural (closest being D major).
    # On the other end of the circle, if we're in a relative mode of Ab major,
    #   such as F minor, we should sooner use a Cb than a B natural, because
    #   again a key containing Cb (namely Gb major) is closer than any key
    #   containing a B natural (the closest being C major).

    for tonic_offset, modifier in MAJOR_SCALE_MODIFIERS:
        note = MAJOR_SCALE_NOTES[(notes_offset + tonic_offset) % 7]
        chromatic_scale.append(Key(
            note,
            modifier + rel_major_key.key_sig[note],
        ))

    relative_midi_to_keys = {
        key.relative_midi(): key
        for key in chromatic_scale}

    NUM_MIDI = 48
    MIDI_LOW = 48

    midi_to_abc_note = {}

    for midi in range(MIDI_LOW, MIDI_LOW + NUM_MIDI):
        octave = (midi // 12) - 1
        relative_midi = midi % 12
        key = relative_midi_to_keys[relative_midi]

        midi_to_abc_note[midi] = AbcNote(
            letter=key.letter,
            modifier=key.modifier,
            octave=octave
        )

    return midi_to_abc_note

if __name__ == '__main__':
    km = KeyedMode('G')

    print(km.keyed_mode)
    print(km.rel_major_key)

    midi_to_abc_note = get_midi_to_abc_note(km.rel_major_key)

    print(midi_to_abc_note)

    # TODO map all MIDIs to abc notes

    # TODO then pass through and break up into bars

    # at start of each bar reset the active modifiers

    # for each note, check if midi pitch is in active modifiers
    #   if it is, remove the modifier from the ABC note and use the letter on its own. This means
    #   the relevant sharp or flat had already been used this bar.
    # 
    # Then check if the midi pitch is an accidental (there's a fixed set of accidental pitches for each key signature)
    # 
    # if it is not an accidental, use the base note without any modifiers
    # 
    # if it is an accidental, use the base note *with* the modifier, and update the active modifiers to include this pitch.
    # 
    # after N notes insert a new bar line 

    print(km.rel_major_key.key_sig)