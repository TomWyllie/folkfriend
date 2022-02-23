import re
from key_types import MusicalKey
from key_types import get_relative_midi

# This lookup says: for each mode, if a note X is such that starting on X
#   takes the scale back to a major mode, then how many semitones above the 
#   first note of the scale is note X.
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

key_mode_parser = re.compile(
    r'^(?P<letter>[a-g])(?P<modifier>#?b?) ?(?P<mode>\w*)$', re.IGNORECASE)

def parse_rel_major(key_and_mode: str) -> MusicalKey:
    key_and_mode = key_and_mode.strip()

    # Parse string input into (letter, modifier, mode)
    try:
        match = key_mode_parser.match(key_and_mode.lower())
        assert match is not None
        groups = match.groupdict()
        assert groups['mode'] in MODES_RELATIVE_MAJOR_TONIC
    except AssertionError:
        raise RuntimeError(f'Invalid keyed mode "{key_and_mode}"')

    # Extract key without mode
    letter = groups['letter']
    modifier = {
        '': 0,
        '#': 1,
        'b': -1,
    }[groups['modifier']]
    base_key = MusicalKey(letter, modifier)

    # Apply mode to find equivalent (relative) major key
    rel_midi = get_relative_midi(base_key)
    rel_midi -= MODES_RELATIVE_MAJOR_TONIC[groups['mode']]
    rel_midi %= 12
    return KEYS_BY_RELATIVE_MIDI[rel_midi]
