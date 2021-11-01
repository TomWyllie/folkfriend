use crate::decode::types::PitchInterval;
use crate::ff_config;

pub struct PitchModel {
    scores: Vec<f32>,
    all_other_scores: f32,
}

impl PitchModel {
    pub fn new() -> PitchModel {
        let base_scores = vec![
            -2.6399, // -12,
            -4.3941, // -11,
            -2.9723, // -10,
            -2.1666, // -9,
            -2.3065, // -8,
            -1.1626, // -7,
            -3.7312, // -6,
            -0.6308, // -5,
            -0.6756, // -4,
            -0.3947, // -3,
            -0.2396, // -2,
            -1.3759, // -1,
            -f32::INFINITY  // zero is handled separately. By definition it's not a note transition.
            -1.3005, // 1,
            -0.0000, // 2,
            -0.3356, // 3,
            -0.5968, // 4,
            -0.3042, // 5,
            -3.0499, // 6,
            -1.2219, // 7,
            -2.4878, // 8,
            -2.7728, // 9,
            -3.5722, // 10,
            -5.1491, // 11,
            -3.4140, // 12,
        ];

        let base_scores = base_scores
            .iter()
            .map(|x| (ff_config::PITCH_MODEL_SHIFT + x) * ff_config::PITCH_MODEL_WEIGHT)
            .collect();
        let all_other_scores =
            (ff_config::PITCH_MODEL_SHIFT + -30.0) * ff_config::PITCH_MODEL_WEIGHT;

        PitchModel {
            scores: base_scores,
            all_other_scores: all_other_scores,
        }
    }

    pub fn score(&self, interval: &PitchInterval) -> f32 {
        if interval == &0 {
            return ff_config::BASE_ENERGY_SCORE;
        }

        match self.scores.get((12 + interval) as usize) {
            Some(x) => *x,
            None => self.all_other_scores,
        }
    }
}
