use crate::decode::types::{Contour, Pitch};
use std::collections::HashMap;

pub struct AbcProcessor {
    base_map: HashMap<Pitch, &'static str>,
}

impl AbcProcessor {
    pub fn new() -> AbcProcessor {
        AbcProcessor {
            base_map: [
                (Pitch::new(72), "c"),
                (Pitch::new(73), "^c"),
                (Pitch::new(74), "d"),
                (Pitch::new(75), "^d"),
                (Pitch::new(76), "e"),
                (Pitch::new(77), "f"),
                (Pitch::new(78), "^f"),
                (Pitch::new(79), "g"),
                (Pitch::new(80), "^g"),
                (Pitch::new(81), "a"),
                (Pitch::new(82), "^a"),
                (Pitch::new(83), "b"),
            ]
            .iter()
            .cloned()
            .collect(),
        }
    }

    pub fn midi_to_abc(&self, midi: u32) -> String {
        let mut apos = 0;
        let mut commas = 0;
        let mut midi = midi;

        while midi >= 84 {
            apos += 1;
            midi -= 12;
        }

        while midi <= 71 {
            commas += 1;
            midi += 12;
        }

        let mut base = self.base_map.get(&Pitch::new(midi)).unwrap().to_string();

        if commas >= 1 {
            base = base.to_uppercase();
            commas -= 1;
        }

        return base + &",".repeat(commas) + &"'".repeat(apos);
    }

    pub fn contour_to_abc(&self, contour: &Contour) -> String {
        let mut hold = 0;
        let mut last_pitch = None;
        let mut out = Vec::new();

        for pitch in contour {
            if Some(pitch) == last_pitch {
                hold += 1;
                continue;
            } else if hold > 0 {
                out.push(format!("{}", hold + 1));
                hold = 0;
            }

            out.push(format!(" {}", self.midi_to_abc(pitch.value())));
            last_pitch = Some(pitch);
        }

        return out.join("");
    }
}