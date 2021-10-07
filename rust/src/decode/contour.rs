use crate::decode::types::{Contour, Duration, LatticePath, Pitch};
use crate::ff_config;

pub fn contour_from_lattice_path(lattice_path: &LatticePath) -> Contour {
    if lattice_path.len() == 0 {
        return Vec::new();
    }

    let mut pitches: Vec<Pitch> = Vec::new();
    let mut durations: Vec<Duration> = Vec::new();

    let mut prev_pitch = lattice_path[0];
    let mut prev_dur: Duration = 1;

    for pitch in lattice_path {
        if *pitch == prev_pitch {
            prev_dur += 1;
        } else {
            pitches.push(prev_pitch);
            durations.push(prev_dur);
            prev_pitch = *pitch;
            prev_dur = 1;
        }
    }

    durations = durations
        .iter()
        .map(|d| *d as f32 / ff_config::TEMP_TEMPO_PARAM)
        .map(|d| d.round())
        .map(|d| if d >= 1. { d as Duration } else { 1 })
        .collect();

    let mut contour: Contour = Vec::new();

    for (duration, pitch) in durations.iter().zip(pitches) {
        contour.extend(vec![pitch; *duration as usize]);
    }

    return contour;
}
