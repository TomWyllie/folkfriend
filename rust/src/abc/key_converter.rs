use crate::abc::key_types::{
    get_relative_midi, AbcNote, AbcVocab, MusicalKey, MusicalKeySignature, MusicalMode,
    PitchModifier, ScaleShape,
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
        let modifier_str: String = "=".to_string();
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
    let rel_major = parse_rel_major(key, mode);
    let abc_vocab = get_abc_vocab(rel_major);

    // Convert to ABC notation
    // TODO move to types
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

        let abc_note = abc_vocab[midi];
        let duration_str: String = "".to_string();
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
        let condition_1: bool = !note_is_modified && is_accidental(rel_major, *midi);
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

    let mut output_abc = format!("K:{}{}\n", key.to_abc(), get_mode_as_abc(mode));
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

pub fn get_mode_as_abc(mode: MusicalMode) -> String {
    return match mode.tonic {
        MusicalMode::IONIAN => "maj",
        MusicalMode::DORIAN => "dor",
        MusicalMode::MIXOLYDIAN => "mix",
        MusicalMode::AEOLIAN => "min",
    }
    .to_string();
}

pub fn detect_key_and_mode(midi_seq: &Contour) -> (MusicalKey, MusicalMode) {
    let mut mode_shapes: HashMap<MusicalMode, ScaleShape> = HashMap::new();
    // Each of these shapes is normalised to sum to one. This represents the
    //   probability mass function
    mode_shapes.insert(
        MusicalMode {
            tonic: MusicalMode::DORIAN,
        },
        vec![
            0.25061224, 0.00055867, 0.14169932, 0.08923983, 0.00325907, 0.12707732, 0.00095709,
            0.17060512, 0.00217626, 0.04171721, 0.16928502, 0.00281284,
        ],
    );

    mode_shapes.insert(
        MusicalMode {
            tonic: MusicalMode::IONIAN,
        },
        vec![
            0.23721947, 0.00089920, 0.14192422, 0.00117854, 0.17147175, 0.07980328, 0.00336021,
            0.18184678, 0.00104605, 0.10996197, 0.00410795, 0.06718059,
        ],
    );

    mode_shapes.insert(
        MusicalMode {
            tonic: MusicalMode::AEOLIAN,
        },
        vec![
            0.23153994, 0.00116728, 0.12028706, 0.15227597, 0.00250881, 0.13079765, 0.00221498,
            0.18448871, 0.04365511, 0.00570442, 0.11622747, 0.00913261,
        ],
    );

    mode_shapes.insert(
        MusicalMode {
            tonic: MusicalMode::MIXOLYDIAN,
        },
        vec![
            0.24891100, 0.00058114, 0.11803482, 0.00410037, 0.1079509, 0.13229921, 0.00053683,
            0.19185175, 0.00106514, 0.07561318, 0.11076458, 0.00829107,
        ],
    );
    let mut shape_query: ScaleShape = vec![0.; 12];
    for midi in midi_seq.iter() {
        shape_query[(midi % 12) as usize] += 1.0
    }

    // Create sliding windows of shape vector, i.e. a 'circulant matrix'
    shape_query.extend_from_within(..);
    let sliding_windows = shape_query.windows(12);

    let mut hi_score: f32 = 0.0;
    let mut hi_mode: Option<MusicalMode> = None;
    let mut hi_key: Option<MusicalKey> = None;

    // For each mode, do a circular autocorrelation between the pre-known shapes
    //   in MODE_SHAPES, and the shape of this tune. Where they line up best,
    //   the score is highest. This is mathematically equivalent to minimising
    //   the squared difference between the given shape and the pre-known shapes
    //   in MODE_SHAPES, which means it's probably the maximum-likelihood
    //   estimator given the p.m.f.s in MODE_SHAPES, or something like that :)
    for (mode, known_shape) in &mode_shapes {
        for (rel_midi, window) in sliding_windows.enumerate() {
            let score: f32 = known_shape
                .iter()
                .zip(window.iter())
                .map(|(x, y)| x * y)
                .sum();
            if score > hi_score {
                hi_score = score;
                hi_mode = Some(*mode);
                let (letter, modifier) = KEYS_BY_RELATIVE_MIDI[rel_midi as usize];
                hi_key = Some(MusicalKey { letter, modifier });
            }
        }
    }
    return (hi_key.unwrap(), hi_mode.unwrap());
}

pub fn parse_rel_major(key: MusicalKey, mode: MusicalMode) -> MusicalKey {
    // Apply mode to find equivalent (relative) major key. See how the enum
    //   values of MusicalMode are chosen to explain this computation.
    let rel_midi = (get_relative_midi(&key) - mode.tonic as u32) % 12;
    let (letter, modifier) = KEYS_BY_RELATIVE_MIDI[rel_midi as usize];
    return MusicalKey { letter, modifier };
}

pub fn get_abc_vocab(key: MusicalKey) -> AbcVocab {
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
    let abc_vocab_one_octave: HashMap<Pitch, MusicalKey> = HashMap::new();
    for chrom_note in chromatic_scale.iter() {
        abc_vocab_one_octave.insert(get_relative_midi(chrom_note), *chrom_note);
    }

    // Expand the one octave vocubulary all octaves.
    let abc_vocab: AbcVocab = HashMap::new();
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

pub fn is_accidental(key: MusicalKey, midi_pitch: Pitch) -> bool {
    /* Check if a pitch is an accidental note in the major mode of a key. */
    let accidentals = vec![1, 3, 6, 8, 10];
    let tonic_offset = (midi_pitch - get_relative_midi(&key)) % 12;
    return accidentals.contains(&tonic_offset);
}

pub fn get_major_key_signature(key: MusicalKey) -> MusicalKeySignature {
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

    for letter in base_key_sig.keys() {
        *base_key_sig.get_mut(letter).unwrap() += key.modifier;
    }

    return base_key_sig;
}

// if __name__ == '__main__':
//     jenny = [71, 74, 76, 78, 81, 76, 78, 74, 74, 78, 74, 76, 78, 79, 76, 74, 78, 74, 76, 76, 74, 71, 74, 74, 78, 74, 76, 78, 79, 76, 81, 69, 69, 69, 76, 78,
//              76, 78, 74, 74, 78, 78, 74, 76, 78, 79, 76, 74, 76, 78, 78, 74, 76, 76, 74, 71, 74, 74, 78, 74, 76, 78, 79, 76, 81, 69, 69, 69, 76, 78, 76, 78, 74]
//     time_will_end = [64, 76, 64, 74, 60, 59, 71, 74, 69, 62, 67, 69, 71, 71, 63, 71, 67, 67, 66, 64, 64, 62, 64, 64, 66, 67, 67, 71, 69, 62,
//                      66, 66, 67, 67, 55, 55, 67, 69, 67, 55, 67, 79, 78, 78, 60, 60, 67, 64, 76, 64, 60, 60, 74, 71, 71, 74, 62, 69, 69, 67, 69, 71, 71, 69]
//     banks_of_allan = [73, 71, 71, 73, 71, 71, 69, 69, 69, 73, 73, 73, 73, 71, 69, 69, 73, 73, 76, 76, 76, 76, 81, 78, 87, 81, 76, 81, 81,
//                       66, 78, 66, 62, 86, 76, 81, 81, 73, 73, 73, 71, 69, 73, 76, 76, 76, 88, 94, 81, 78, 81, 78, 76, 73, 69, 73, 64, 64, 71, 71, 69, 71]
//     slide_from_grace = [74, 71, 71, 69, 66, 74, 76, 78, 74, 74, 71, 71, 69, 66, 69, 69, 71, 74, 74, 71, 71, 69, 66, 74,
//                         76, 78, 78, 78, 76, 76, 76, 74, 76, 76, 78, 83, 83, 78, 81, 78, 76, 74, 76, 78, 69, 71, 69, 69, 66, 69, 74, 76]
//     duchess = [71, 71, 71, 71, 69, 68, 64, 64, 64, 59, 59, 64, 71, 71, 71, 71, 71, 71, 71, 69, 71, 73,
//                76, 78, 78, 76, 78, 80, 71, 71, 71, 71, 69, 68, 69, 64, 71, 64, 68, 64, 64, 64, 64, 64,
//                59, 64, 68, 66, 64, 66, 68, 69, 68, 66, 64, 66, 64, 64, 64, 71, 71, 71, 71, 69, 68, 64,
//                64, 64, 59, 59, 64, 71, 71, 71, 71, 69, 71, 71, 69, 71, 73, 76, 78, 78, 76, 78, 80, 71,
//                71, 71, 71, 69, 68, 69, 71, 69, 68, 64, 64, 64, 64, 64, 59, 61, 64, 64, 68, 66, 64, 66, 69, 68, 66, 64, 66, 68, 64, 64, 69, 64, 68, 66, 64, 71, 64, 59, 64, 64, 59, 64, 66, 64, 66, 71, 69, 68, 66, 64, 66, 68, 64, 57, 59, 61, 64, 66, 68, 69, 71, 69, 68, 66, 64, 71, 64, 64, 64, 73, 64, 64, 64, 71, 73, 75, 76, 78, 80, 76, 73, 78, 76, 71, 71, 68, 69, 71, 73, 75, 76, 78, 73, 71, 71, 68, 66, 64, 71, 64, 59, 64, 94, 94, 64, 64, 64, 64, 66, 71, 69, 68, 66, 64, 66, 68, 64, 59, 61, 64, 66, 68, 64, 66, 68, 71, 68, 66, 64, 71, 64, 64, 64, 73, 64, 64, 64, 71, 75, 76, 78, 80, 76, 73, 78, 76, 71, 71, 68, 69, 71, 73, 75, 76, 78, 80, 78, 71, 76]
//     knitting = [62, 62, 62, 60, 62, 57, 60, 62, 65, 64, 64, 62, 62, 57, 60, 62, 65, 64, 65, 67, 65, 67, 69, 65, 64, 62, 64, 65, 67, 64, 60, 57, 62, 62, 62, 60, 62, 57, 60, 62, 65, 64, 64, 62, 62, 57, 60, 62, 65, 64, 65, 67, 65, 67, 69, 65, 64, 62, 60, 57, 62,
//                 62, 62, 62, 62, 74, 74, 72, 72, 69, 72, 72, 74, 72, 72, 69, 71, 69, 67, 64, 65, 64, 62, 65, 65, 64, 65, 67, 69, 65, 67, 64, 65, 62, 64, 60, 62, 74, 74, 72, 72, 69, 72, 72, 74, 72, 72, 69, 71, 69, 67, 64, 65, 64, 62, 65, 65, 64, 65, 67, 69, 65, 67, 64]

//     contour = time_will_end
//     // contour = jenny
//     // contour =  banks_of_allan
//     // contour = slide_from_grace
//     // contour = duchess
//     // contour = knitting

//     output_abc = contour_to_abc(contour)
//     print(output_abc)
