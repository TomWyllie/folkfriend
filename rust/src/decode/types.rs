use crate::ff_config;

// LatticePath is not time-normalised. The time dimension corresponds to frames
//  from the feature extrator, whereas in 'Contour' the time dimension
//  corresponds to actual musical notes. Many LatticePaths at different tempos
//  could generate the same contour.
pub type LatticeIndex = usize;
pub type LatticePath = Vec<LatticeIndex>;

pub type Pitch = u32;
pub type PitchInterval = i32;
pub type Contour = Vec<Pitch>;
pub type ContourString = String;


pub fn contour_to_contour_string(contour: &Contour) -> ContourString {
    contour.iter().map(|pitch| {
        ff_config::CONTOUR_TO_QUERY_CHAR[(pitch - ff_config::MIDI_LOW) as usize]
    }).collect()
}

pub fn contour_string_to_contour(contour_string: &ContourString) -> Contour {
    contour_string.chars().map(|contour_char| {
        ff_config::MIDI_LOW + ff_config::CONTOUR_TO_QUERY_CHAR
            .iter()
            .position(|&c| c == contour_char)
            .expect("ContourString contained non-note characters") as Pitch
    }).collect()
}

// #[cfg(test)]
// mod tests {
//     use super::*;

//     #[test]
//     fn test_from_contour_string() {
//         let contour: Contour = Vec::new();
//     }
// }
