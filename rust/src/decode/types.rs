use crate::ff_config;

pub type Duration = u32;
pub type PitchInterval = i32;

#[derive(Copy, Clone, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Pitch {
    value: u32,
}

// LatticePath is not time-normalised. The time dimension corresponds to frames
//  from the feature extrator, whereas in 'Contour' the time dimension
//  corresponds to actual musical notes. Many LatticePaths could generate the
//  same contour, if time-stretched at different tempos.
pub type LatticePath = Vec<Pitch>;
pub type Contour = Vec<Pitch>;

#[derive(Debug)]
pub struct ContourString {
    value: String,
}

#[derive(Copy, Clone, Debug)]
pub struct Note {
    pitch: Pitch,
    duration: Duration,
}

impl Pitch {
    pub fn new(value: u32) -> Pitch {
        // A zero length note is not a note, so duration cannot be zero.
        if !(ff_config::MIDI_LOW <= value && value <= ff_config::MIDI_HIGH) {
            panic!(
                "The pitch of a note must lie within [{}, {}]",
                ff_config::MIDI_LOW,
                ff_config::MIDI_HIGH
            );
        }
        return Pitch { value: value };
    }

    pub fn value(&self) -> u32 {
        self.value
    }

    pub fn to_query_char(&self) -> char {
        ff_config::CONTOUR_TO_QUERY_CHAR[(self.value - ff_config::MIDI_LOW) as usize]
    }
}

impl Note {
    pub fn new(pitch: Pitch, duration: u32) -> Note {
        // A zero length note is not a note, so duration cannot be zero.
        if !(duration > 0) {
            panic!("The duration of a note must be greater than zero");
        }

        Note {
            pitch: pitch,
            duration: duration,
        }
    }

    pub fn pitch(&self) -> Pitch {
        self.pitch
    }

    pub fn duration(&self) -> Duration {
        self.duration
    }
}

impl ContourString {
    pub fn new(contour: Contour) -> ContourString {
        ContourString {
            value: contour.iter().map(|pitch| pitch.to_query_char()).collect(),
        }
    }

    pub fn from_string(string: &String) -> ContourString {
        ContourString {
            value: string.to_string(),
        }
    }

    pub fn value(&self) -> String {
        self.value.to_string()
    }

    pub fn append_to_contour(&self, mut contour: Contour) -> Contour {
        for contour_char in self.value().chars() {
            let pitch = ff_config::CONTOUR_TO_QUERY_CHAR
                .iter()
                .position(|&c| c == contour_char)
                .expect("ContourString contained non-note characters");
            contour.push(Pitch::new(ff_config::MIDI_LOW + pitch as u32));
        }
        return contour;
    }
}

// #[cfg(test)]
// mod tests {
//     use super::*;

//     #[test]
//     fn test_from_contour_string() {
//         let contour: Contour = Vec::new();
//     }
// }
