use crate::ff_config;

pub type LatticePath = Vec<Pitch>;
pub type Contour = Vec<Pitch>;
pub type ContourString = String;
pub type Duration = u32;
pub type Pitch = u32;
pub type PitchInterval = i32;

pub trait ToContourString {
    fn to_contour_string(&self) -> String {
        "".to_string()
    }
}

impl ToContourString for Contour {
    fn to_contour_string(&self) -> String {
        self
            .iter()
            .map(|midi| ff_config::CONTOUR_TO_QUERY_CHAR[(midi - ff_config::MIDI_LOW) as usize])
            .collect()
    }
} 

pub fn from_contour_string(contour_string: &String) -> Contour {
    let mut contour: Contour = Vec::new();
    for contour_char in contour_string.chars() {
        let pitch = ff_config::CONTOUR_TO_QUERY_CHAR.iter().position(|&c| c == contour_char).unwrap();
        contour.push(ff_config::MIDI_LOW + pitch as u32);
    }
    return contour;
}
