use crate::ff_config;
// use std::collections::HashMap;
use crate::decode::types::Note;
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

    pub fn score(&self, note: &Note) -> f32 {
        return self.compute_score(&note.duration());
    }

    fn compute_score(&self, duration: &Duration) -> f32 {
        // Score the likelihood of a note being a given length

        // A zero length note is not a note, so duration cannot be zero.
        if !(duration > &0) {
            panic!("Cannot compute score for a duration zero");
        }

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn time_const_equivalency() {
        let tm1 = TempoModel::new(2.0);
        let tm2 = TempoModel::new(10.0);
        assert_eq!(tm1.compute_score(&5), tm2.compute_score(&25));
    }
    
    #[test]
    #[should_panic]
    fn zero_duration_invalid() {
        let tm = TempoModel::new(10.0);
        tm.compute_score(&0);
    }

    #[test]
    fn multiples_of_time_const_are_better() {
        let tc = 10.0;
        let tm = TempoModel::new(tc);

        // Local maximum at the value of time constant
        assert!(tm.compute_score(&10) > tm.compute_score(&9));
        assert!(tm.compute_score(&10) > tm.compute_score(&11));
        
        // Local maximum at integer multiples of time constant
        assert!(tm.compute_score(&20) > tm.compute_score(&9));
        assert!(tm.compute_score(&20) > tm.compute_score(&11));
    }
}
