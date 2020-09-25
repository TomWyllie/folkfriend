"""
    Generate the required config files which define how each .png will be
    generated.
"""

import json
import os
import random

from tqdm import tqdm


def generate_random_config(ds_dir, num):
    """
        Instruments in the FolkFriend soundfont file are:

        Bank:Instrument Description
        000:000 Grand Piano
        000:001 Violin
        000:002 Accordion
        000:003 Flute
        000:004 Recorder
        000:005 Banjo
        000:006 Mandolin
        000:007 Clarinet
        000:008 Oboe
        000:009 Pan Flute
        000:010 Harp
        000:040 Nylon String Guitar
        000:041 Steel String Guitar
        000:042 Jazz Guitar
        000:043 Clean Guitar
        000:044 Palm Muted Guitar
        000:045 Distortion Guitar
        000:046 Overdrive Guitar
        000:047 Acoustic Bass
        000:048 Fingered Bass
        000:049 Picked Bass
    """

    # Relative probabilities of sampling different instruments for melody
    melody_probs = {
        0: 1.,
        1: 8.,
        2: 4.,
        3: 3.,
        4: 3.,  # Recorder ~= Whistle (no good tin whistle sound-font)
        5: 2.,
        6: 2.,
        7: 0.3,
        8: 0.3,
        9: 0.3,
        10: 0.5,
        40: 1.,
    }

    chord_probs = {
        0: 10.,
        2: 10.,
        6: 2.,
        10: 1.,
        40: 10.,
        41: 10.,
        42: 3.,
        43: 3.,
        44: 2.,
        45: 1.,
        46: 1.,
        47: 1.5,
        48: 1.5,
        49: 1.5,
    }

    def random_melody_inst(k):
        return random.choices(list(melody_probs.keys()), k=k,
                              weights=melody_probs.values())

    def random_accomp(k):
        return random.choices(list(chord_probs.keys()), k=k,
                              weights=chord_probs.values())

    tunes_with_chords_path = os.path.join(ds_dir, 'chords.json')
    with open(tunes_with_chords_path, 'r') as f:
        indices_with_chords = json.load(f)

    configs = []

    for i in tqdm(range(num)):
        # TODO lots of other audio parameters could go into these files
        #   EQ, gain, reverb, etc
        # TODO percussive accompaniments (drums)
        # TODO background noise (pub chatter etc)

        # These weights are fairly arbitrary, but give a roughly realistic
        #   distribution of instruments.
        number_melodies = random.choices(range(1, 5), k=1,
                                         weights=[0.3, 0.4, 0.25, 0.05])[0]
        number_accomps = random.choices(range(0, 4), k=1,
                                        weights=[0.5, 0.25, 0.15, 0.10])[0]

        # We need at least one melody voice for each chord in the abc file
        number_accomps = min(number_accomps, number_melodies)

        # We only need to constrain ourselves to tunes with chords if we
        #   want an accompaniment.
        possible_tunes = (indices_with_chords if number_accomps >= 1
                          else range(indices_with_chords[-1]))

        # We add a random transposition to reduce any key bias, and to
        #   improve the melodic range of the model (few tunes will naturally
        #   contain outlier notes at extreme melodic range).
        transpositions = [random.choice(range(-11, 12))]
        lo = transpositions[0] < 0

        for non_lead_melody in range(number_melodies - 1):
            shift = 0

            # Sometimes add on a shifted octave if there's
            #   more than one instrument
            if random.random() > 0.60:
                # Add or minus an octave to the other melody voices
                shift = 12 if lo else -12
            transpositions.append(transpositions[0] + shift)

        melodies = random_melody_inst(number_melodies)

        # if shifted:
        #     # Make sure we have an octave difference on the lead instrument.
        #     #   Otherwise if the instrument an octave up is something much
        #     #   quieter than the other instruments
        #     melodies[-1] = melodies[0]

        config = {
            'index': i,
            'tune': random.choice(possible_tunes),
            'melodies': melodies,
            'chords': random_accomp(number_accomps),
            'transpositions': transpositions,
            'tempo': get_random_tempo(),
            'chord_octave_shifts': random.choices((0, 1), k=number_accomps)
        }
        configs.append(config)

    with open(os.path.join(ds_dir, 'configs.json'), 'w') as f:
        json.dump(configs, f)
    print(f'Generated {num} config files to configs.json')


def get_random_tempo():
    if random.random() > 0.80:
        return random.choice(range(50, 100))
    else:
        return random.choice(range(100, 280))
