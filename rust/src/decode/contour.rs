use crate::decode::types::{Contour, LatticeIndex, LatticePath, Pitch};
use crate::decode::DecoderError;
use crate::ff_config;

pub fn contour_from_lattice_path(lattice_path: &LatticePath) -> Result<Contour, DecoderError> {
    if lattice_path.len() == 0 {
        return Err(DecoderError);
    }

    let mut pitches: Vec<Pitch> = Vec::new();
    let mut durations: Vec<usize> = Vec::new();

    let mut prev_pitch = lattice_ind_to_pitch(&lattice_path[0]);
    let mut prev_dur: usize = 1;

    for lattice_index in lattice_path {
        let pitch = lattice_ind_to_pitch(&lattice_index);
        if pitch == prev_pitch {
            prev_dur += 1;
        } else {
            pitches.push(prev_pitch as u32);
            durations.push(prev_dur);
            prev_pitch = pitch;
            prev_dur = 1;
        }
    }

    durations = durations
        .iter()
        .map(|d| *d as f32 / ff_config::TEMP_TEMPO_PARAM)
        .map(|d| d.round())
        .map(|d| if d >= 1. { d as usize } else { 1 })
        .collect();

    let mut contour: Contour = Vec::new();

    for (duration, pitch) in durations.iter().zip(pitches) {
        // TODO tidy up distintion between paths and lattice indices here
        contour.extend(vec![pitch; *duration as usize]);
    }

    return Ok(contour);
}

pub fn lattice_ind_to_pitch(li: &LatticeIndex) -> Pitch {
    return ff_config::MIDI_LOW + *li as u32;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_lattice_path() {
        let lp = LatticePath::new();
        assert!(contour_from_lattice_path(&lp).is_err());
    }
}
