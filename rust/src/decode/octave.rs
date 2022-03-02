use crate::decode::types::{Contour};
use crate::ff_config;

pub fn correct_contour_octave(contour: &mut Contour) {
    // Sometimes after decoding, the feature extraction has resulted in an
    //  octave error. For example, solo tin whistle generally is transcribed
    //  an octave higher than it actually is due to strong harmonics.
    
    // "Decision boundary" is if 85% of notes are above MIDI note 76 (Fiddle
    //   open E)
    const SHRILL_THRESHOLD_PITCH: u32 = 76;
    const SHRILL_THRESHOLD_ENERGY: f32 = 0.85;

    let mut pitches = contour.clone();
    pitches.sort();
    let decision_index = (contour.len() as f32 * (1. - SHRILL_THRESHOLD_ENERGY)).round();

    if pitches[decision_index as usize] >= SHRILL_THRESHOLD_PITCH {
        for i in 0..contour.len() {
            if contour[i] > ff_config::MIDI_LOW + 12 {
                contour[i] -= 12;
            }
        }
    }
}