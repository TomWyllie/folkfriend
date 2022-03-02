use crate::abc::key_types::{
    AbcNote, AbcVocab, MusicalKey, MusicalKeySignature, MusicalMode, PitchModifier, ScaleShape,
};
use crate::decode::types::{Contour, Pitch};
use crate::ff_config;
use std::collections::HashMap;
use std::convert::TryInto;

pub const KEYS_BY_RELATIVE_MIDI: [(char, PitchModifier); 12] = [
    ('C', 0),
    ('C', 1),
    ('D', 0),
    ('E', -1),
    ('E', 0),
    ('F', 0),
    ('F', 1),
    ('G', 0),
    ('A', -1),
    ('A', 0),
    ('B', -1),
    ('B', 0),
];

impl AbcNote {
    pub fn get_modifier_abc(&self) -> String {
        let mut modifier_str: String = "=".to_string();
        if self.modifier > 0 {
            modifier_str = "^".repeat(self.modifier.try_into().unwrap());
        } else if self.modifier < 0 {
            modifier_str = "_".repeat(self.modifier.abs().try_into().unwrap());
        }
        return modifier_str;
    }

    pub fn get_letter_abc(&self) -> String {
        let lowercase = self.octave >= 5;
        if lowercase {
            return self.letter.to_lowercase().to_string();
        } else {
            return self.letter.to_uppercase().to_string();
        }
    }

    pub fn get_octave_abc(&self) -> String {
        if self.octave >= 6 {
            return "'".repeat((self.octave - 5).try_into().unwrap());
        } else if self.octave <= 3 {
            return ",".repeat((4 - self.octave).try_into().unwrap());
        } else {
            return "".to_string();
        }
    }

    pub fn get_as_abc(&self, apply_modifier: bool) -> String {
        let mut modifier: String = "".to_string();

        if apply_modifier {
            modifier = self.get_modifier_abc();
        }

        let letter = self.get_letter_abc();
        let octave = self.get_octave_abc();

        return format!("{}{}{}", modifier, letter, octave);
    }
}

pub fn contour_to_abc(contour: &Contour) -> String {
    // Merge consecutive quavers into single notes with longer durations
    let contour_with_durations = contour_to_midi_durations(contour);

    // Auto-detect the key / mode based on the pitches in the contour
    let (key, mode) = detect_key_and_mode(contour);
    let rel_major = parse_rel_major(&key, &mode);
    let abc_vocab = get_abc_vocab(&rel_major);

    // Convert to ABC notation
    type Bar = Vec<String>;
    type Bars = Vec<String>;

    let mut active_modifiers: HashMap<String, i32> = HashMap::new();
    let mut bar: Bar = vec![];
    let mut bars: Bars = vec![];

    for (midi, duration) in contour_with_durations.iter() {
        if bar.len() == 4 {
            bar.push(" ".to_string());
        }

        if bar.len() >= 9 {
            bars.push(bar.join(""));
            active_modifiers = HashMap::new();
            bar.clear();
        }

        let abc_note = &abc_vocab[midi];
        let mut duration_str: String = "".to_string();
        if duration >= &2 {
            duration_str = duration.to_string();
        }
        let unmodified_note: String = abc_note.get_letter_abc();
        let note_is_modified: bool = active_modifiers.contains_key(&unmodified_note);
        let modifier_lookup = active_modifiers.get(&unmodified_note);
        let modifier_is_correct: bool = match modifier_lookup {
            Some(&modifier) => modifier == abc_note.modifier,
            _ => false,
        };
        let condition_1: bool = !note_is_modified && is_accidental(&rel_major, *midi);
        let condition_2: bool = note_is_modified && !modifier_is_correct;
        let use_modifier = condition_1 || condition_2;
        if use_modifier {
            active_modifiers.insert(unmodified_note, abc_note.modifier);
        }
        let note_str = abc_note.get_as_abc(use_modifier);
        bar.push(format!("{}{}", note_str, duration_str));
    }

    if bar.len() > 0 {
        bars.push(bar.join(""));
    }

    let mut output_abc = format!("K:{}{}\n", key.to_abc(), get_mode_as_abc(&mode));
    let mut bars_on_line = 0;
    for bar in bars.iter() {
        if bars_on_line >= 4 {
            output_abc.push_str("\n");
            bars_on_line = 0;
        }

        output_abc.push_str(&bar);
        output_abc.push_str(" |");
        bars_on_line += 1;
    }

    return output_abc;
}

pub fn contour_to_midi_durations(contour: &Contour) -> Vec<(Pitch, u32)> {
    let mut hold: u32 = 0;
    let mut last_pitch = contour[0];
    let mut out: Vec<(Pitch, u32)> = vec![];

    for pitch in contour {
        if pitch != &last_pitch || hold >= 4 {
            out.push((last_pitch, hold));
            hold = 1;
        } else {
            hold += 1;
        }
        last_pitch = *pitch;
    }

    out.push((last_pitch, hold));

    return out;
}

pub fn get_relative_midi(key: &MusicalKey) -> Pitch {
    let letter_offset: Pitch = match key.letter {
        'A' => 0,
        'B' => 2,
        'C' => 3,
        'D' => 5,
        'E' => 7,
        'F' => 8,
        'G' => 10,
        _ => panic!("Invalid musical letter."),
    };
    let rel_midi: i32 = 69 + key.modifier + (letter_offset as i32);
    return (rel_midi % 12).try_into().unwrap();
}

pub fn get_mode_as_abc(mode: &MusicalMode) -> String {
    return match mode.tonic {
        MusicalMode::IONIAN => "maj",
        MusicalMode::DORIAN => "dor",
        MusicalMode::MIXOLYDIAN => "mix",
        MusicalMode::AEOLIAN => "min",
        // This should never happen. But it's probably better than panic!().
        _ => "",
    }
    .to_string();
}

pub fn detect_key_and_mode(contour: &Contour) -> (MusicalKey, MusicalMode) {
    // Each of these shapes is formed by looking at all of the tunes in the
    //  database in that mode, counting the occurrences of notes relative to
    //  the tonic, and normalising the distribution to sum to one. This
    //  represents the probability mass function. Finally the natural log of
    //  these probabilities is taken, so that when we multiply by the number of
    //  observations of each note in a given sequence, we are taking the joint
    //  probability of that sequence under a multinomial distribution, assuming
    //  identically-independently drawn notes from that distribution. This is
    //  calculated for 4 modes X 12 keys = 48 multinomial distributions,
    //  and the distribution with the highest log probability ("best
    //  explanation") of the observations is chosen as the predicted key / mode.
    //  Changing to log probabilities increased accuracy from 68% to 72%.
    let mode_shapes: Vec<(i32, ScaleShape)> = vec![
        (
            MusicalMode::IONIAN,
            vec![
                -1.43876953,
                -7.01400508,
                -1.95246203,
                -6.74347889,
                -1.76333675,
                -2.52819067,
                -5.69575181,
                -1.70459081,
                -6.86273411,
                -2.2076207,
                -5.49483116,
                -2.70037091,
            ],
        ),
        (
            MusicalMode::MIXOLYDIAN,
            vec![
                -1.39065988,
                -7.45051887,
                -2.13677561,
                -5.49667807,
                -2.22607878,
                -2.02268918,
                -7.52982909,
                -1.65103234,
                -6.84464903,
                -2.58212467,
                -2.20034823,
                -4.79257625,
            ],
        ),
        (
            MusicalMode::DORIAN,
            vec![
                -1.38384839,
                -7.4899516,
                -1.95404793,
                -2.41642781,
                -5.7263134,
                -2.06295956,
                -6.95161313,
                -1.76840363,
                -6.13014747,
                -3.17684153,
                -1.77617148,
                -5.87356063,
            ],
        ),
        (
            MusicalMode::AEOLIAN,
            vec![
                -1.46300289,
                -6.75307902,
                -2.11787423,
                -1.88206081,
                -5.98794674,
                -2.03410381,
                -6.1125119,
                -1.69016701,
                -3.13143494,
                -5.16651397,
                -2.15220606,
                -4.69590375,
            ],
        ),
    ];

    let mut shape_query: ScaleShape = vec![0.; 12];
    for midi in contour.iter() {
        shape_query[(midi % 12) as usize] += 1.0
    }

    // Create sliding windows of shape vector, i.e. a 'circulant matrix'
    shape_query.extend_from_within(..);
    let sliding_windows = shape_query.windows(12);

    let mut hi_score: f32 = f32::NEG_INFINITY;
    let mut hi_mode: Option<MusicalMode> = None;
    let mut hi_key: Option<MusicalKey> = None;

    // For each mode, do a circular autocorrelation between the pre-known shapes
    //   in MODE_SHAPES, and the shape of this tune. Where they line up best,
    //   the score is highest. This is mathematically equivalent to minimising
    //   the squared difference between the given shape and the pre-known shapes
    //   in MODE_SHAPES, which means it's probably the maximum-likelihood
    //   estimator given the p.m.f.s in MODE_SHAPES, or something like that :)
    for (rel_midi, window) in sliding_windows.enumerate() {
        for (tonic, known_shape) in mode_shapes.iter() {
            let score: f32 = known_shape
                .iter()
                .zip(window.iter())
                .map(|(x, y)| x * y)
                .sum();
            if score > hi_score {
                hi_score = score;
                hi_mode = Some(MusicalMode { tonic: *tonic });
                let (letter, modifier) = KEYS_BY_RELATIVE_MIDI[rel_midi as usize];
                hi_key = Some(MusicalKey { letter, modifier });
            }
        }
    }
    return (hi_key.unwrap(), hi_mode.unwrap());
}

pub fn parse_rel_major(key: &MusicalKey, mode: &MusicalMode) -> MusicalKey {
    // Apply mode to find equivalent (relative) major key. See how the enum
    //   values of MusicalMode are chosen to explain this computation.
    let rel_midi = (get_relative_midi(&key) - mode.tonic as u32) % 12;
    let (letter, modifier) = KEYS_BY_RELATIVE_MIDI[rel_midi as usize];
    return MusicalKey { letter, modifier };
}

pub fn get_abc_vocab(key: &MusicalKey) -> AbcVocab {
    /* Create a mapping from MIDI pitches to AbcNotes.

    To do this correctly requires care. We can't just say all the "black keys"
        are sharps: depending on which key we're in we might want to use flats
        instead of sharps.

    Furthermore, when we see an accidental, instead of just using sharps in
        sharp keys and flats in flat keys, we choose notes based on proximity,
        within the circle of fifths, to the current scale.

    We use the approach from the following post:
        https://music.stackexchange.com/a/85848 ("Approach //3")

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

    */

    // TODO shift this scale from A to C just makes things more consisent +
    //   easier to understand.

    // We only to write the 'vocabulary' of which notes in the scale should be
    //   raised or lowered, once, and then we transpose it depending on which
    //   key we're in.
    let scale_letters = "ABCDEFG";
    let scale_modifiers: Vec<(Pitch, PitchModifier)> = vec![
        // (tonic_offset, modifier)
        (0, 0),  // A
        (0, 1),  // (A)#
        (1, 0),  // B
        (2, -1), // (C#)b
        (2, 0),  // C#
        (3, 0),  // D
        (3, 1),  // (D)#
        (4, 0),  // E
        (4, 1),  // (E)#
        (5, 0),  // F#
        (6, -1), // (G#)b
        (6, 0),  // G#
    ];

    let key_signature: MusicalKeySignature = get_major_key_signature(key);
    let mut chromatic_scale: Vec<MusicalKey> = Vec::new();
    let letter_offset = scale_letters.find(key.letter).expect("Invalid note");

    for (tonic_offset, modifier) in scale_modifiers.iter() {
        let mut offset = letter_offset + *tonic_offset as usize;
        offset %= scale_letters.len();
        let letter = scale_letters.chars().nth(offset).unwrap();

        chromatic_scale.push(MusicalKey {
            letter: letter,
            modifier: key_signature.get(&letter).unwrap() + modifier,
        });
    }

    // Build our vocabulary for this key, for one arbitrary octave.
    let mut abc_vocab_one_octave: HashMap<Pitch, MusicalKey> = HashMap::new();
    for chrom_note in chromatic_scale.iter() {
        abc_vocab_one_octave.insert(get_relative_midi(chrom_note), *chrom_note);
    }

    // Expand the one octave vocubulary all octaves.
    let mut abc_vocab: AbcVocab = HashMap::new();
    for midi in ff_config::MIDI_LOW..=ff_config::MIDI_HIGH {
        // Floor division
        let octave = (midi / 12) - 1;
        let relative_midi = midi % 12;
        let key = abc_vocab_one_octave.get(&relative_midi).unwrap();

        abc_vocab.insert(
            midi,
            AbcNote {
                letter: key.letter,
                modifier: key.modifier,
                octave: octave as i32,
            },
        );
    }

    return abc_vocab;
}

pub fn is_accidental(key: &MusicalKey, midi_pitch: Pitch) -> bool {
    /* Check if a pitch is an accidental note in the major mode of a key. */
    let accidentals = vec![1, 3, 6, 8, 10];
    let tonic_offset = (midi_pitch - get_relative_midi(&key)) % 12;
    return accidentals.contains(&tonic_offset);
}

pub fn get_major_key_signature(key: &MusicalKey) -> MusicalKeySignature {
    /* Get the key signature of a the major mode of a given key. */
    let circle_of_fifths = "FCGDAEB";

    // We find the key signature by working out the sharps or flats
    //   for the 'unmodified' scale, i.e. for Bb major we start with
    //   B major, then apply the modifier (i.e. flatten every letter).

    // Initialise key signature as F major
    let mut base_key_sig: MusicalKeySignature = HashMap::new();
    base_key_sig.insert('B', -1); // All other default to zero

    let num_steps_from_f = circle_of_fifths.find(key.letter).unwrap();
    let mut modifier_ptr: usize = 6;
    for _ in 0..num_steps_from_f {
        let letter_to_modify = circle_of_fifths.chars().nth(modifier_ptr % 7).unwrap();
        *base_key_sig.entry(letter_to_modify).or_insert(0) += 1;
        modifier_ptr += 1;
    }

    for letter in circle_of_fifths.chars() {
        *base_key_sig.entry(letter).or_insert(0) += key.modifier;
    }

    return base_key_sig;
}
