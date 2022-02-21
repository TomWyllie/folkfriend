import re
from pprint import pprint

from key_detector import KeyDetector

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


class MajorKey:
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
        key_sig = MajorKey.get_simple_major_key_signature(self.letter)
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

    def is_accidental(self, midi_pitch):
        accidentals = {1, 3, 6, 8, 10}
        return (midi_pitch - self.relative_midi()) % 12 in accidentals

    def relative_midi(self):
        return (69 + OFFSETS_BY_KEY[self.letter] + self.modifier) % 12


class AbcNote:
    def __init__(self, letter: str, modifier: int, octave: int):
        self.letter: str = letter
        self.modifier: int = modifier
        self.octave: int = octave

    def __repr__(self):
        return self.get_as_abc(modifier=True)

    def get_modifier_abc(self):
        modifier_str = '='
        if self.modifier > 0:
            modifier_str = self.modifier * '^'
        elif self.modifier < 0:
            modifier_str = abs(self.modifier) * '_'
        return modifier_str

    def get_letter_abc(self):
        lowercase = self.octave >= 5
        return self.letter.lower() if lowercase else self.letter.upper()

    def get_octave_abc(self) -> str:
        if self.octave >= 6:
            return "'" * (self.octave - 5)
        elif self.octave <= 3:
            return ',' * (4 - self.octave)
        else:
            return ''

    def get_as_abc(self, modifier=True):
        return (
            f'{self.get_modifier_abc() if modifier else ""}'
            f'{self.get_letter_abc()}'
            f'{self.get_octave_abc()}')


KEYS_BY_OFFSET = {
    0: MajorKey('A', 0),
    1: MajorKey('B', -1),
    2: MajorKey('B', 0),
    3: MajorKey('C', 0),
    4: MajorKey('C', 1),
    5: MajorKey('D', 0),
    6: MajorKey('E', -1),
    7: MajorKey('E', 0),
    8: MajorKey('F', 0),
    9: MajorKey('F', 1),
    10: MajorKey('G', 0),
    11: MajorKey('A', -1),
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


def parse_rel_major(keyed_mode) -> MajorKey:
    keyed_mode = keyed_mode.strip()

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

    rel_major_key_offset = (
        base_key - MODES_RELATIVE_MAJOR_TONIC[groups['mode']])
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
        chromatic_scale.append(MajorKey(
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


class AbcGenerator():
    def __init__(self):
        pass

    def contour_to_abc(self, contour):

        # Auto-detect the key / mode based on the MIDI notes in the contour.
        key_detector = KeyDetector()
        key, mode = key_detector.detect_key(contour)
        key_and_mode = key + mode[:3]
        rel_major = parse_rel_major(key_and_mode)
        midi_to_abc_note = get_midi_to_abc_note(rel_major)

        contour_with_durations = AbcGenerator.get_durations_in_contour(contour)

        active_modifiers = {}
        bars = []
        bar = []

        for midi, duration in contour_with_durations:
            if len(bar) == 4:
                bar.append(' ')

            if len(bar) >= 9:
                bars.append(bar)
                active_modifiers = {}
                bar = []

            abc_note = midi_to_abc_note[midi]
            duration_str = str(duration) if duration >= 2 else ''

            unmodified_note = abc_note.get_as_abc(modifier=False)
            modified_note = abc_note.get_as_abc(modifier=True)

            note_is_modified = unmodified_note in active_modifiers
            modifier_is_correct = active_modifiers.get(
                unmodified_note) == abc_note.modifier

            if (
                (rel_major.is_accidental(midi) and not note_is_modified) or
                    (note_is_modified and not modifier_is_correct)):
                bar.append(
                    f'{modified_note}{duration_str}')
                active_modifiers[unmodified_note] = abc_note.modifier
            else:
                bar.append(
                    f'{unmodified_note}{duration_str}')

        if len(bar):
            bars.append(bar)

        bars = [''.join(bar) for bar in bars]

        output_abc = f'K:{key_and_mode}\n'

        bars_on_line = 0
        for bar in bars:
            if bars_on_line >= 4:
                output_abc += '\n'
                bars_on_line = 0

            output_abc += bar
            output_abc += ' |'
            bars_on_line += 1

        return output_abc

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

    @staticmethod
    def get_durations_in_contour(contour):
        hold = 0
        last_pitch = contour[0]
        out = []

        for pitch in contour:
            if pitch != last_pitch:
                out.append((last_pitch, hold))
                hold = 1
            else:
                hold += 1
            last_pitch = pitch

        out.append((last_pitch, hold))

        return out


if __name__ == '__main__':
    jenny = [71, 74, 76, 78, 81, 76, 78, 74, 74, 78, 74, 76, 78, 79, 76, 74, 78, 74, 76, 76, 74, 71, 74, 74, 78, 74, 76, 78, 79, 76, 81, 69, 69, 69, 76, 78, 76, 78, 74, 74, 78, 78, 74, 76, 78, 79, 76, 74, 76, 78, 78, 74, 76, 76, 74, 71, 74, 74, 78, 74, 76, 78, 79, 76, 81, 69, 69, 69, 76, 78, 76, 78, 74]
    time_will_end = [64, 76, 64, 74, 60, 59, 71, 74, 69, 62, 67, 69, 71, 71, 63, 71, 67, 67, 66, 64, 64, 62, 64, 64, 66, 67, 67, 71, 69, 62, 66, 66, 67, 67, 55, 55, 67, 69, 67, 55, 67, 79, 78, 78, 60, 60, 67, 64, 76, 64, 60, 60, 74, 71, 71, 74, 62, 69, 69, 67, 69, 71, 71, 69]
    banks_of_allan = [73, 71, 71, 73, 71, 71, 69, 69, 69, 73, 73, 73, 73, 71, 69, 69, 73, 73, 76, 76, 76, 76, 81, 78, 87, 81, 76, 81, 81, 66, 78, 66, 62, 86, 76, 81, 81, 73, 73, 73, 71, 69, 73, 76, 76, 76, 88, 94, 81, 78, 81, 78, 76, 73, 69, 73, 64, 64, 71, 71, 69, 71]
    slide_from_grace = [74, 71, 71, 69, 66, 74, 76, 78, 74, 74, 71, 71, 69, 66, 69, 69, 71, 74, 74, 71, 71, 69, 66, 74, 76, 78, 78, 78, 76, 76, 76, 74, 76, 76, 78, 83, 83, 78, 81, 78, 76, 74, 76, 78, 69, 71, 69, 69, 66, 69, 74, 76]

    # contour = time_will_end
    # contour = jenny
    # contour =  banks_of_allan
    contour = slide_from_grace

    abc_generator = AbcGenerator()
    output_abc = abc_generator.contour_to_abc(contour)

    print(output_abc)
