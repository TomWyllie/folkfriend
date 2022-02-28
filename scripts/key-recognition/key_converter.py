import numpy as np

from key_types import (
    MusicalKey,
    MusicalMode,
    AbcVocab,
    MusicalKeySignature,
    MidiPitch,
    get_relative_midi
)

KEYS_BY_RELATIVE_MIDI = {
    0: MusicalKey('C', 0),
    1: MusicalKey('C', 1),
    2: MusicalKey('D', 0),
    3: MusicalKey('E', -1),
    4: MusicalKey('E', 0),
    5: MusicalKey('F', 0),
    6: MusicalKey('F', 1),
    7: MusicalKey('G', 0),
    8: MusicalKey('A', -1),
    9: MusicalKey('A', 0),
    10: MusicalKey('B', -1),
    11: MusicalKey('B', 0),
}

MODE_SHAPES = {
    # Each of these shapes is normalised to sum to one. This represents the
    #   probability mass function
    MusicalMode.DORIAN: [
        0.25061224, 0.00055867, 0.14169932, 0.08923983, 0.00325907,
        0.12707732, 0.00095709, 0.17060512, 0.00217626, 0.04171721,
        0.16928502, 0.00281284],
    MusicalMode.IONIAN: [
        0.23721947, 0.00089920, 0.14192422, 0.00117854, 0.17147175,
        0.07980328, 0.00336021, 0.18184678, 0.00104605, 0.10996197,
        0.00410795, 0.06718059],
    MusicalMode.AEOLIAN: [
        0.23153994, 0.00116728, 0.12028706, 0.15227597, 0.00250881,
        0.13079765, 0.00221498, 0.18448871, 0.04365511, 0.00570442,
        0.11622747, 0.00913261],
    MusicalMode.MIXOLYDIAN: [
        0.24891100, 0.00058114, 0.11803482, 0.00410037, 0.1079509,
        0.13229921, 0.00053683, 0.19185175, 0.00106514, 0.07561318,
        0.11076458, 0.00829107]}


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


def contour_to_abc(contour) -> str:
    # Merge consecutive quavers into single notes with longer durations
    contour_with_durations = contour_to_midi_durations(contour)

    # Auto-detect the key / mode based on the pitches in the contour
    key, mode = detect_key_and_mode(contour)
    rel_major = parse_rel_major(key, mode)
    abc_vocab = get_abc_vocab(rel_major)

    # Convert to ABC notation
    active_modifiers = {}
    bar = []
    bars = []

    for midi, duration in contour_with_durations:
        if len(bar) == 4:
            bar.append(' ')

        if len(bar) >= 9:
            bars.append(bar)
            active_modifiers = {}
            bar = []

        abc_note = abc_vocab[midi]
        duration_str = str(duration) if duration >= 2 else ''

        unmodified_note = abc_note.get_as_abc(modifier=False)
        modified_note = abc_note.get_as_abc(modifier=True)

        note_is_modified = unmodified_note in active_modifiers
        modifier_is_correct = active_modifiers.get(
            unmodified_note) == abc_note.modifier

        if (
            (is_accidental(rel_major, midi) and not note_is_modified) or
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

    output_abc = f'K:{key}{get_mode_as_abc(mode)}\n'

    bars_on_line = 0
    for bar in bars:
        if bars_on_line >= 4:
            output_abc += '\n'
            bars_on_line = 0

        output_abc += bar
        output_abc += ' |'
        bars_on_line += 1

    return output_abc


def contour_to_midi_durations(contour) -> list[tuple[MidiPitch, int]]:
    hold = 0
    last_pitch = contour[0]
    out = []

    for pitch in contour:
        if pitch != last_pitch or hold >= 4:
            out.append((last_pitch, hold))
            hold = 1
        else:
            hold += 1
        last_pitch = pitch

    out.append((last_pitch, hold))

    return out


def get_mode_as_abc(mode: MusicalMode) -> str:
    return {
        MusicalMode.IONIAN: 'maj',
        MusicalMode.DORIAN: 'dor',
        MusicalMode.MIXOLYDIAN: 'mix',
        MusicalMode.AEOLIAN: 'min',
    }[mode]


def detect_key_and_mode(midi_seq) -> tuple[MusicalKey, MusicalMode]:
    shape_query = np.zeros(12)
    for midi in midi_seq:
        shape_query[midi % 12] += 1
    shape_query_stacked = np.concatenate((shape_query, shape_query))

    hi_score = 0
    hi_key = None
    hi_mode = None

    # For each mode, do a circular autocorrelation between the pre-known shapes
    #   in MODE_SHAPES, and the shape of this tune. Where they line up best,
    #   the score is highest. This is mathematically equivalent to minimising
    #   the squared difference between the given shape and the pre-known shapes
    #   in MODE_SHAPES, which means it's probably the maximum-likelihood
    #   estimator given the p.m.f.s in MODE_SHAPES, or something like that :)
    for mode, known_shape in MODE_SHAPES.items():

        for rel_midi in range(12):
            sliding_window = shape_query_stacked[rel_midi: rel_midi + 12]
            score = np.dot(known_shape, sliding_window)

            if score > hi_score:
                hi_score = score
                hi_key = KEYS_BY_RELATIVE_MIDI[rel_midi]
                hi_mode = mode

    return hi_key, hi_mode


def parse_rel_major(key: MusicalKey, mode: MusicalMode) -> MusicalKey:
    # Apply mode to find equivalent (relative) major key. See how the enum
    #   values of MusicalMode are chosen to explain this computation.
    rel_midi = (get_relative_midi(key) - mode) % 12
    return KEYS_BY_RELATIVE_MIDI[rel_midi]


def get_abc_vocab(key: MusicalKey) -> AbcVocab:
    """Create a mapping from MIDI pitches to AbcNotes.

    To do this correctly requires care. We can't just say all the "black keys"
        are sharps: depending on which key we're in we might want to use flats
        instead of sharps.

    Furthermore, when we see an accidental, instead of just using sharps in 
        sharp keys and flats in flat keys, we choose notes based on proximity,
        within the circle of fifths, to the current scale.

    We use the approach from the following post:
        https://music.stackexchange.com/a/85848 ("Approach #3")

    For example G major is two steps away (G -> C -> F) from F major, which
        contains a Bb. However it is four steps away (G -> D -> A -> E -> B)
        from B major - which is the nearest key containing an A#. Therefore,
        even though G major is a "sharp" key using an F# in the key signature,
        we use a Bb instead of an A# when denoting that accidental, because
        it's "closer" musically.

    This leads to some interesting results. For example, in the key of F# 
        major, we are "closer" (in steps in the circle of fifths) to a key
        containing F## (i.e., G# major) than we are to any key containing a G
        natural (closest being D major).

    On the other end of the circle, if we're in a relative mode of Ab major,
        such as F minor, we should sooner use a Cb than a B natural, because
        again a key containing Cb (namely Gb major) is closer than any key
        containing a B natural (the closest being C major).

    """

    # TODO shift this scale from A to C just makes things more consisent +
    #   easier to understand.

    # We only to write the 'vocabulary' of which notes in the scale should be
    #   raised or lowered, once, and then we transpose it depending on which
    #   key we're in.
    scale_letters = 'ABCDEFG'
    scale_modifiers = [
        # (tonic_offset, modifier)
        (0, 0),     # A
        (0, 1),     # (A)#
        (1, 0),     # B
        (2, -1),    # (C#)b
        (2, 0),     # C#
        (3, 0),     # D
        (3, 1),     # (D)#
        (4, 0),     # E
        (4, 1),     # (E)#
        (5, 0),     # F#
        (6, -1),    # (G#)b
        (6, 0),     # G#
    ]

    key_signature: MusicalKeySignature = get_major_key_signature(key)
    chromatic_scale = []
    letter_offset = scale_letters.index(key.letter)

    for tonic_offset, modifier in scale_modifiers:
        offset = letter_offset + tonic_offset
        offset %= len(scale_letters)
        letter = scale_letters[offset]

        chromatic_scale.append(
            MusicalKey(letter, key_signature[letter] + modifier,
                       ))

    # Build our vocabulary for this key, for one arbitrary octave.
    abc_vocab_one_octave = {}
    for chrom_note in chromatic_scale:
        abc_vocab_one_octave[get_relative_midi(chrom_note)] = chrom_note

    # TODO import these from ff_config when in rust
    NUM_MIDI = 48
    MIDI_LOW = 48

    # Expand the one octave vocubulary all octaves.
    abc_vocab = {}
    for midi in range(MIDI_LOW, MIDI_LOW + NUM_MIDI):
        octave = (midi // 12) - 1
        relative_midi = midi % 12

        key = abc_vocab_one_octave[relative_midi]
        abc_vocab[midi] = AbcNote(
            letter=key.letter,
            modifier=key.modifier,
            octave=octave
        )

    return abc_vocab


def is_accidental(key: MusicalKey, midi_pitch: MidiPitch) -> bool:
    """Check if a pitch is an accidental note in the major mode of a key."""
    accidentals = {1, 3, 6, 8, 10}
    return (midi_pitch - get_relative_midi(key)) % 12 in accidentals


def get_major_key_signature(key: MusicalKey) -> MusicalKeySignature:
    """Get the key signature of a the major mode of a given key."""
    circle_of_fifths = list('FCGDAEB')

    # We find the key signature by working out the sharps or flats
    #   for the 'unmodified' scale, i.e. for Bb major we start with
    #   B major, then apply the modifier (i.e. flatten every letter).

    # Initialise key signature as F major
    base_key_sig = {letter: 0 for letter in circle_of_fifths}
    base_key_sig['B'] = -1

    try:
        num_steps_from_f = circle_of_fifths.index(key.letter)
    except ValueError:
        raise RuntimeError(
            f'Invalid letter "{key.letter}"')

    modifier_ptr = 6
    for _ in range(num_steps_from_f):
        letter_to_modify = circle_of_fifths[modifier_ptr % 7]
        base_key_sig[letter_to_modify] += 1
        modifier_ptr += 1

    for letter in base_key_sig:
        base_key_sig[letter] += key.modifier

    return base_key_sig


if __name__ == '__main__':
    jenny = [71, 74, 76, 78, 81, 76, 78, 74, 74, 78, 74, 76, 78, 79, 76, 74, 78, 74, 76, 76, 74, 71, 74, 74, 78, 74, 76, 78, 79, 76, 81, 69, 69, 69, 76, 78,
             76, 78, 74, 74, 78, 78, 74, 76, 78, 79, 76, 74, 76, 78, 78, 74, 76, 76, 74, 71, 74, 74, 78, 74, 76, 78, 79, 76, 81, 69, 69, 69, 76, 78, 76, 78, 74]
    time_will_end = [64, 76, 64, 74, 60, 59, 71, 74, 69, 62, 67, 69, 71, 71, 63, 71, 67, 67, 66, 64, 64, 62, 64, 64, 66, 67, 67, 71, 69, 62,
                     66, 66, 67, 67, 55, 55, 67, 69, 67, 55, 67, 79, 78, 78, 60, 60, 67, 64, 76, 64, 60, 60, 74, 71, 71, 74, 62, 69, 69, 67, 69, 71, 71, 69]
    banks_of_allan = [73, 71, 71, 73, 71, 71, 69, 69, 69, 73, 73, 73, 73, 71, 69, 69, 73, 73, 76, 76, 76, 76, 81, 78, 87, 81, 76, 81, 81,
                      66, 78, 66, 62, 86, 76, 81, 81, 73, 73, 73, 71, 69, 73, 76, 76, 76, 88, 94, 81, 78, 81, 78, 76, 73, 69, 73, 64, 64, 71, 71, 69, 71]
    slide_from_grace = [74, 71, 71, 69, 66, 74, 76, 78, 74, 74, 71, 71, 69, 66, 69, 69, 71, 74, 74, 71, 71, 69, 66, 74,
                        76, 78, 78, 78, 76, 76, 76, 74, 76, 76, 78, 83, 83, 78, 81, 78, 76, 74, 76, 78, 69, 71, 69, 69, 66, 69, 74, 76]
    duchess = [71, 71, 71, 71, 69, 68, 64, 64, 64, 59, 59, 64, 71, 71, 71, 71, 71, 71, 71, 69, 71, 73,
               76, 78, 78, 76, 78, 80, 71, 71, 71, 71, 69, 68, 69, 64, 71, 64, 68, 64, 64, 64, 64, 64,
               59, 64, 68, 66, 64, 66, 68, 69, 68, 66, 64, 66, 64, 64, 64, 71, 71, 71, 71, 69, 68, 64,
               64, 64, 59, 59, 64, 71, 71, 71, 71, 69, 71, 71, 69, 71, 73, 76, 78, 78, 76, 78, 80, 71,
               71, 71, 71, 69, 68, 69, 71, 69, 68, 64, 64, 64, 64, 64, 59, 61, 64, 64, 68, 66, 64, 66, 69, 68, 66, 64, 66, 68, 64, 64, 69, 64, 68, 66, 64, 71, 64, 59, 64, 64, 59, 64, 66, 64, 66, 71, 69, 68, 66, 64, 66, 68, 64, 57, 59, 61, 64, 66, 68, 69, 71, 69, 68, 66, 64, 71, 64, 64, 64, 73, 64, 64, 64, 71, 73, 75, 76, 78, 80, 76, 73, 78, 76, 71, 71, 68, 69, 71, 73, 75, 76, 78, 73, 71, 71, 68, 66, 64, 71, 64, 59, 64, 94, 94, 64, 64, 64, 64, 66, 71, 69, 68, 66, 64, 66, 68, 64, 59, 61, 64, 66, 68, 64, 66, 68, 71, 68, 66, 64, 71, 64, 64, 64, 73, 64, 64, 64, 71, 75, 76, 78, 80, 76, 73, 78, 76, 71, 71, 68, 69, 71, 73, 75, 76, 78, 80, 78, 71, 76]
    knitting = [62, 62, 62, 60, 62, 57, 60, 62, 65, 64, 64, 62, 62, 57, 60, 62, 65, 64, 65, 67, 65, 67, 69, 65, 64, 62, 64, 65, 67, 64, 60, 57, 62, 62, 62, 60, 62, 57, 60, 62, 65, 64, 64, 62, 62, 57, 60, 62, 65, 64, 65, 67, 65, 67, 69, 65, 64, 62, 60, 57, 62,
                62, 62, 62, 62, 74, 74, 72, 72, 69, 72, 72, 74, 72, 72, 69, 71, 69, 67, 64, 65, 64, 62, 65, 65, 64, 65, 67, 69, 65, 67, 64, 65, 62, 64, 60, 62, 74, 74, 72, 72, 69, 72, 72, 74, 72, 72, 69, 71, 69, 67, 64, 65, 64, 62, 65, 65, 64, 65, 67, 69, 65, 67, 64]

    contour = time_will_end
    # contour = jenny
    # contour =  banks_of_allan
    # contour = slide_from_grace
    # contour = duchess
    # contour = knitting

    output_abc = contour_to_abc(contour)
    print(output_abc)
