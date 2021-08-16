use crate::folkfriend::ff_config;

pub fn score_note_length(length: usize, length_scale: f32) -> f32 {
    // Score the likelihood of a note being a given length

    // 'dimensionless' length scaling, i.e. relative to the tempo.
    let scaled_length: f32 = length as f32 / length_scale;

    // The optimal score partitions into N notes, where N is one of these two
    //   bounds. 
    let n_lo = scaled_length.floor();
    let n_hi = n_lo + 1.0;

    let n_hi_score = n_hi * (scaled_length / n_hi).ln().abs();
    let score: f32;

    if n_lo > 0. {
        let n_lo_score = n_lo * (scaled_length / n_lo).ln().abs();
        score = n_lo_score.min(n_hi_score);
    } else {
        score = n_hi_score;
    }

    return ff_config::TEMPO_MODEL_WEIGHT * -score;
}