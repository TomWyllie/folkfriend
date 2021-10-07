use crate::ff_config;
// use std::collections::HashMap;
use crate::decode::types::Duration;

pub struct TempoModel {
    time_const: f32,
    // duration_to_score: HashMap<usize, f32>
}

impl TempoModel {
    pub fn new(length_scale: f32) -> TempoModel {
        TempoModel {
            time_const: length_scale,
            // duration_to_score: HashMap::new()
        }
    }

    pub fn score(&self, duration: &Duration) -> f32 {
        // TODO experiment with caching this value for efficiency
        return self.compute_score(duration);
    }

    fn compute_score(&self, duration: &Duration) -> f32 {
        // Score the likelihood of a note being a given length

        // 'dimensionless' length scaling, i.e. relative to the tempo.
        let length: f32 = *duration as f32 / self.time_const;

        // The optimal score partitions into N notes, where N is one of these two
        //   bounds.
        let n_lo = length.floor();
        let n_hi = n_lo + 1.0;

        let n_hi_score = n_hi * (length / n_hi).ln().abs();
        let score: f32;

        if n_lo > 0. {
            let n_lo_score = n_lo * (length / n_lo).ln().abs();
            score = n_lo_score.min(n_hi_score);
        } else {
            score = n_hi_score;
        }

        return ff_config::TEMPO_MODEL_WEIGHT * -score;
    }
}
