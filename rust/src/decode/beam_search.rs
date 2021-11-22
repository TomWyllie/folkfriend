use crate::decode::pitch_model::PitchModel;
use crate::decode::types::{LatticePath, PitchInterval};
use crate::decode::DecoderError;
use crate::feature::normalise::Normalisable;
use crate::feature::types::Features;
use crate::ff_config;

pub fn decode(features: &mut Features) -> Result<LatticePath, DecoderError> {
    // For a fixed tempo, decode spectral features.
    //  The features are a rectangular matrix of energy spectra over time.
    //  That is, at each time point there is an energy value for each MIDI
    //  note specified in the config file. To translate this matrix into
    //  a sequence of notes, the best path through the lattice (matrix) is
    //  found using dynamic programming, governed by a few rules in how likely
    //  relative lengths of notes / relative jumps in pitch, are.
    // Normalise energy to average 1.0 AU per frame
    let feature_energy_by_frame = features.energy_by_frame();
    let total_energy: f32 = feature_energy_by_frame.iter().sum();
    if total_energy == 0.0 {
        // Cannot decode complete silence!
        return Err(DecoderError);
    }
    features.normalise(&feature_energy_by_frame);

    // Do this after normalising in case trimmed silence means not enough
    //  frames remain.
    if features.len() < 5 {
        return Err(DecoderError);
    }

    let pitch_model = PitchModel::new();

    // How does this dynamic programming work?
    //   1. Start one lattice path off on each possible pitch.
    //   2. Propose all possible next states, for each of the current lattice paths.
    //   3. Score each proposal
    //   4. Retain only the optimal path from the start to each pitch
    //   5. Go to step 2, ending when all frames have been processed.

    // Dynamic programming lattice; each entry in the grid represents the
    //   score of the highest-scored path to that state.
    let mut lattice_scores: Vec<[f32; ff_config::MIDI_NUM as usize]> = Vec::new();

    // Set up first frame
    let first_scores = features[0];
    lattice_scores.push(first_scores);

    for frame in 1..features.len() {
        let mut next_scores: [f32; ff_config::MIDI_NUM as usize] =
            [-f32::INFINITY; ff_config::MIDI_NUM as usize];

        // For each state at time t...
        for state_t in 0..ff_config::MIDI_NUM as usize {
            // ...find the optimal route from time t-1.
            for state_t_minus_one in 0..ff_config::MIDI_NUM as usize {
                let interval = state_t as PitchInterval - state_t_minus_one as PitchInterval;
                let interval_score = pitch_model.score(&interval);
                let energy_score = features[frame][state_t];
                let carry_score = lattice_scores[frame - 1][state_t_minus_one];
                let proposed_score = carry_score + interval_score + energy_score;

                if proposed_score > next_scores[state_t] {
                    next_scores[state_t] = proposed_score;
                }
            }
        }
        lattice_scores.push(next_scores);
    }

    // ===============================
    // === Retrace through lattice ===
    // ===============================
    let mut lattice_path_backtrace = LatticePath::new();
    let mut scores_backtrace: Vec<f32> = Vec::new();

    // Iterating backwards in time
    for frame in (0..features.len()).rev() {
        let (ind, score): (usize, &f32) = lattice_scores[frame]
            .iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).expect("NaN score"))
            .unwrap();
        lattice_path_backtrace.push(ind);
        scores_backtrace.push(*score);
    }

    // We do something interesting here. Trim off all points with zero scores.
    //  Parameters of the algorithm are carefully tuned so that silence leads
    //  to negative scores. So we trim points at which the score is negative
    //  (at the start), and any parts at the end lower than the maximum score.

    // Remember these backtraces are BACKWARDS because we iterated backwards
    //  in time just above.

    // TODO reinstate these trimming things because they kind of work ish

    // let (max_score_ind, _) = scores_backtrace
    //     .iter()
    //     .enumerate()
    //     .max_by(|(_, a), (_, b)| a.partial_cmp(b).expect("NaN score"))
    //     .unwrap();
    // let hi = scores_backtrace.len() - max_score_ind;

    // let (latest_negative_ind, _) = scores_backtrace
    //     .iter()
    //     .enumerate()
    //     .find(|(_, score)| score < &&0.)
    //     .unwrap_or((scores_backtrace.len(), &0.));
    // let lo = scores_backtrace.len() - latest_negative_ind;

    // lattice_path_backtrace.reverse();
    // return Ok(lattice_path_backtrace[lo..hi].to_vec());
    lattice_path_backtrace.reverse();
    return Ok(lattice_path_backtrace);
}

// #[cfg(test)]
// mod tests {
//     use super::*;

//     #[test]
//     fn test_empty_features() {
//         let pm = PitchModel::new();
//         let tm = TempoModel::new(ff_config::TEMP_TEMPO_PARAM);
//         let mut empty_feats = Features::new();
//         assert!(decode(&mut empty_feats, &pm, &tm).is_err());
//     }
// }
