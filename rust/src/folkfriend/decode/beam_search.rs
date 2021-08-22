use crate::folkfriend::decode::pitch_model::PitchModel;
use crate::folkfriend::decode::proposal::Proposal;
use crate::folkfriend::decode::tempo_model::TempoModel;
use crate::folkfriend::decode::types::{Contour, Pitch};
use crate::folkfriend::ff_config;
use crate::folkfriend::sig_proc::spectrogram::{Features, Spectrogram};

use std::collections::{HashMap, HashSet};

pub fn decode(
    mut features: Features,
    pitch_model: &PitchModel,
    tempo_model: &TempoModel,
) -> (Contour, f32) {
    // For a fixed tempo, decode spectral features

    // Normalise energy to average 1.0 AU per frame
    features.normalise_energy();

    // Start one contour off on each possible pitch.
    //   At each step of the algorithm, propose all possible next states, for
    //   each of the N current contours.
    //   Score each proposal, and determine the top N proposals.
    //   Apply the proposals to update N current contours to N next contours

    // Array of frames; each frame is a list of proposals at that frame
    let mut proposals: Vec<Vec<Proposal>> = Vec::new();
    proposals.push(Vec::new());

    for pitch in 0..ff_config::MIDI_NUM {
        proposals[0].push(Proposal {
            prev_proposal_id: 0,
            pitch: pitch,
            score: features[0][pitch as usize],
            duration: 1,
            pitch_changed: true,
        })
    }

    for frame in 1..features.len() {
        // =====================================
        // === Draft and score new proposals ===
        // =====================================

        let mut pitches: HashSet<Pitch> = HashSet::new();
        for (pitch, energy) in features[frame].iter().enumerate() {
            if energy > &0. {
                pitches.insert(pitch as Pitch);
            }
        }
        let mut drafted_proposals: Vec<Proposal> = Vec::new();
        for (i, prev_prop) in proposals[frame - 1].iter().enumerate() {
            let mut last_pitch: HashSet<Pitch> = HashSet::new();
            last_pitch.insert(prev_prop.pitch as Pitch);

            for pitch in pitches.union(&last_pitch) {
                // Add all non-zero-energy pitches as possible transitions,
                //   as well as possibility of continuing on current pitch.
                let proposal: Proposal = prev_prop.compute_child_proposal(
                    &pitch_model,
                    &tempo_model,
                    i,
                    *pitch,
                    features[frame][*pitch as usize],
                );
                drafted_proposals.push(proposal);
            }
        }
        proposals.push(drafted_proposals);

        // println!("{} proposals drafted and scored", proposals[frame].len());

        // ========================
        // === Dedupe proposals ===
        // ========================

        // If two proposals are on the same pitch, and changed note at the same
        //   time, then choose the one with the higher score. This 'pruning' of
        //   paths that can never be optimal is the key to dynamic programming.

        // This is equivalent to pruning proposals that change to the same pitch
        //   at the same time.

        let mut proposal_ids_to_keep: Vec<usize> = Vec::new();
        let mut best_transitions: HashMap<Pitch, (f32, usize)> = HashMap::new();

        for (i, proposal) in proposals[frame].iter().enumerate() {
            // Carry over contours that didn't change pitch ("can't be ruled out")
            if !proposal.pitch_changed {
                proposal_ids_to_keep.push(i)
            } else {
                let (existing_score, _) = best_transitions
                    .get(&proposal.pitch)
                    .unwrap_or(&(-f32::INFINITY, 0));

                // Retain only the best of contours that just changed
                if proposal.score > *existing_score {
                    best_transitions.insert(proposal.pitch, (proposal.score, i));
                }
            }
        }

        // Carry over the best of the contours that just changed pitch
        // best_transition_ids = [p[1] for p in best_transitions.values()]
        let best_transition_ids = best_transitions.values().map(|a| a.1);
        proposal_ids_to_keep.extend(best_transition_ids);

        // println!("{} proposals remain after deduping", proposal_ids_to_keep.len());

        // Find the IDs of the top ff_config::BEAM_WIDTH proposals
        proposal_ids_to_keep.sort_by(|i, j| {
            proposals[frame][*j]
                .score
                .partial_cmp(&proposals[frame][*i].score)
                .unwrap()
        });

        // This will almost always be true, except for at the start.
        if proposal_ids_to_keep.len() > ff_config::BEAM_WIDTH {
            proposal_ids_to_keep = proposal_ids_to_keep[0..ff_config::BEAM_WIDTH].to_vec();
        }

        // Retain only the top ff_config::BEAM_WIDTH proposals
        let mut keep_mask: Vec<bool> = vec![false; proposals[frame].len()];
        for i_to_keep in proposal_ids_to_keep {
            keep_mask[i_to_keep] = true;
        }
        let mut keep_mask = keep_mask.iter();
        proposals[frame].retain(|_| *keep_mask.next().unwrap());

        // println!("{} proposals computed for frame {}", proposals[frame].len(), frame);
    }

    // ===============================
    // === Retrace through lattice ===
    // ===============================

    let best_final_proposal: Proposal = *proposals[proposals.len() - 1]
        .iter()
        .max_by(|p1, p2| p1.score.partial_cmp(&p2.score).unwrap())
        .unwrap();
    let mut contour_proposals: Vec<Proposal> = vec![best_final_proposal];

    let mut frame: usize = features.len() - 2;
    while frame > 0 {
        let prev_prop = proposals[frame][contour_proposals[0].prev_proposal_id];
        contour_proposals.insert(0, prev_prop);
        frame -= 1;
    }

    let contour: Vec<u32> = contour_proposals
        .iter()
        .map(|p| p.pitch as u32) // Extract proposed pitch
        .map(|pitch| pitch + ff_config::MIDI_LOW) // Index -> MIDI pitch
        .collect();

    return (contour, best_final_proposal.score);
}
