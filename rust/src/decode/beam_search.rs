use crate::decode::pitch_model::PitchModel;
use crate::decode::proposal::Proposal;
use crate::decode::tempo_model::TempoModel;
use crate::decode::types::{LatticePath, Pitch};
use crate::ff_config;
use crate::feature::types::Features;
use crate::feature::normalise::Normalisable;

use std::collections::{HashMap, HashSet};

pub fn decode(
    features: &mut Features,
    pitch_model: &PitchModel,
    tempo_model: &TempoModel,
) -> (LatticePath, f32) {
    // For a fixed tempo, decode spectral features.
    //  The features are a rectangular matrix of energy spectra over time.
    //  That is, at each time point there is an energy value for each MIDI
    //  note specified in the config file. To translate this matrix into
    //  a sequence of notes, the best path through the lattice (matrix) is
    //  found using dynamic programming, governed by a few rules in how likely
    //  relative lengths of notes / relative jumps in pitch, are.

    // Normalise energy to average 1.0 AU per frame
    features.normalise_energy();

    // How does this dynamic programming work?
    //   1. Start one lattice path off on each possible pitch.
    //   2. Propose all possible next states, for each of the current lattice paths.
    //   3. Score each proposal
    //   4. Retain only the top N proposals
    //   5. Go to step 2, ending when all frames have been processed.

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
            // Carry over paths that didn't change pitch ("can't be ruled out")
            if !proposal.pitch_changed {
                proposal_ids_to_keep.push(i)
            } else {
                let (existing_score, _) = best_transitions
                    .get(&proposal.pitch)
                    .unwrap_or(&(-f32::INFINITY, 0));

                // Retain only the best of lattice paths that just changed
                if proposal.score > *existing_score {
                    best_transitions.insert(proposal.pitch, (proposal.score, i));
                }
            }
        }

        // Carry over the best of the lattice paths that just changed pitch
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
    let mut lattice_path_proposals: Vec<Proposal> = vec![best_final_proposal];

    let mut frame: usize = features.len() - 2;
    while frame > 0 {
        let prev_prop = proposals[frame][lattice_path_proposals[0].prev_proposal_id];
        lattice_path_proposals.insert(0, prev_prop);
        frame -= 1;
    }

    let lattice_path: Vec<u32> = lattice_path_proposals
        .iter()
        .map(|p| p.pitch as u32) // Extract proposed pitch
        .map(|pitch| pitch + ff_config::MIDI_LOW) // Index -> MIDI pitch
        .collect();

    return (lattice_path, best_final_proposal.score);
}
