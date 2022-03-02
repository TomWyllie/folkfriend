use crate::decode::types::Pitch;
use std::collections::HashMap;
use std::convert::TryInto;

pub type ScaleShape = Vec<f32>;
pub type PitchModifier = i32;
pub type MusicalKeySignature = HashMap<char, PitchModifier>;
pub type AbcVocab = HashMap<Pitch, AbcNote>;

pub struct AbcNote {
    pub letter: char,
    pub modifier: PitchModifier,
    pub octave: i32,
}

#[derive(PartialEq, Eq, Hash)]
pub struct MusicalMode {
    pub tonic: i32,
}

impl MusicalMode {
    // This lookup says: for each mode, if a note X is such that starting on X
    //   takes the scale back to a major mode, then how many semitones above the
    //   first note of the scale is note X.
    pub const IONIAN: i32 = 0;
    pub const DORIAN: i32 = 2;
    pub const PHRYGIAN: i32 = 4;
    pub const LYDIAN: i32 = 5;
    pub const MIXOLYDIAN: i32 = 7;
    pub const AEOLIAN: i32 = 9;
    pub const LOCRIAN: i32 = 11;
}

pub struct MusicalKey {
    pub letter: char,
    pub modifier: PitchModifier,
}

impl MusicalKey {
    pub fn to_abc(&self) -> String {
        let modifier_str = match self.modifier {
            -1 => "b",
            0 => "",
            1 => "#",
        }
        .to_string();
        return format!("{}{}", self.letter.to_uppercase().to_string(), modifier_str);
    }
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
    };
    let rel_midi: i32 = 69 + key.modifier + (letter_offset as i32);
    return (rel_midi % 12).try_into().unwrap();
}
