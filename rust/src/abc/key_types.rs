use crate::decode::types::Pitch;
use std::collections::HashMap;

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
    // pub const PHRYGIAN: i32 = 4;
    // pub const LYDIAN: i32 = 5;
    pub const MIXOLYDIAN: i32 = 7;
    pub const AEOLIAN: i32 = 9;
    // pub const LOCRIAN: i32 = 11;
}

#[derive(Copy, Clone)]
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
            _ => "",
        }
        .to_string();
        return format!("{}{}", self.letter.to_uppercase().to_string(), modifier_str);
    }
}
