use std::collections::HashMap;
use crate::folkfriend::ff_config;
use crate::folkfriend::decode::types::{PitchInterval};

const ALL_OTHER_SCORES: f32 = -50. * ff_config::PITCH_MODEL_WEIGHT;
const BASE_SCORES: [(PitchInterval, f32); 24] = [
    (-12, -2.639916731),
    (-11, -4.394149488),
    (-10, -2.972304221),
    (-9, -2.166698359),
    (-8, -2.306580069),
    (-7, -1.162611053),
    (-6, -3.731280049),
    (-5, -0.6308846752),
    (-4, -0.6756249503),
    (-3, -0.3947562571),
    (-2, -0.2396100196),
    (-1, -1.375965628),
    (1, -1.300531153),
    (2, 0.),
    (3, -0.3356148385),
    (4, -0.59683188),
    (5, -0.3042728195),
    (6, -3.049916994),
    (7, -1.22192358),
    (8, -2.487884978),
    (9, -2.772818809),
    (10, -3.572246443),
    (11, -5.149161163),
    (12, -3.4140682)
];

pub struct PitchModel {
    scores: HashMap<PitchInterval, f32>
}

impl PitchModel {
    pub fn new() -> PitchModel {
        let mut pm = PitchModel {
            scores: HashMap::new()
        };

        for (interval, base_score) in BASE_SCORES {
            pm.scores.insert(interval, base_score * ff_config::PITCH_MODEL_WEIGHT);
        }

        return pm;
    }

    pub fn score(&self, interval: &PitchInterval) -> f32 {
        return self.scores.get(interval).cloned().unwrap_or(ALL_OTHER_SCORES);
    }
}
