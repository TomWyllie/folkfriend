pub mod pitch_model;
pub mod tempo_model;

use crate::folkfriend::ff_config;
use crate::folkfriend::sig_proc::spectrogram;
use crate::folkfriend::sig_proc::spectrogram::Spectrogram;
use std::collections::{HashMap, HashSet};

pub struct Decoder {
    pitch_model: pitch_model::PitchModel,
    note_length_scale: f32,
}

struct Proposal {
    prev_proposal_id: usize,
    pitch: usize,
    score: f32,
    duration: usize,
    pitch_changed: bool,
}

impl Decoder {
    pub fn new(note_length_scale: f32) -> Decoder {
        Decoder {
            pitch_model: pitch_model::PitchModel::new(),
            note_length_scale: note_length_scale,
        }
    }

    fn decode(&self, mut features: spectrogram::Features) -> (Vec<u32>, f32) {
        // For a fixed tempo, decode spectral features

        let num_frames = features.len();
        let num_midis = ff_config::MIDI_NUM as usize;

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

        for pitch in 0..num_midis {
            proposals[0].push(Proposal {
                prev_proposal_id: 0,
                pitch: pitch,
                score: features[0][pitch as usize],
                duration: 1,
                pitch_changed: true,
            })
        }

        for frame in 1..num_frames {
            // for frame in tqdm(range(1, num_frames)){

            // print(
            //     f'== Analysing frame {frame} of decoder, '
            //     f'with {len(proposals[frame - 1])} '
            //     'current proposals ==')

            // =====================================
            // === Draft and score new proposals ===
            // =====================================

            // start = dt()

            let mut pitches: HashSet<usize> = HashSet::new();
            for (pitch, energy) in features[frame].iter().enumerate() {
                if energy > &0. {
                    pitches.insert(pitch);
                }
            }
            let mut drafted_proposals: Vec<Proposal> = Vec::new();
            for (i, prev_prop) in proposals[frame - 1].iter().enumerate() {
                let tempo_score =
                    tempo_model::score_note_length(prev_prop.duration, self.note_length_scale);
                let mut last_pitch: HashSet<usize> = HashSet::new();
                last_pitch.insert(prev_prop.pitch as usize);
                for pitch in pitches.union(&last_pitch) {
                    // Add all non-zero-energy pitches as possible transitions,
                    //   as well as possibility of continuing on current pitch.
                    // TODO WE GOT TO HERE AND NOW WE NEED TO IMPLEMENT THIS FUNCTION
                    let proposal: Proposal = self.compute_new_proposal(
                        prev_prop,
                        i,
                        *pitch,
                        features[frame][*pitch],
                        &tempo_score,
                    );
                    drafted_proposals.push(proposal);
                }
            }
            proposals.push(drafted_proposals);

            // print(f'{len(proposals[frame])} proposals drafted and scored')

            // print('drafting + scoring', num_frames * 1000 * (dt() - start))
            // ========================
            // === Dedupe proposals ===
            // ========================

            // If two proposals are on the same pitch, and changed note at the same
            //   time, then choose the one with the higher score. This 'pruning' of
            //   paths that can never be optimal is the key to dynamic programming.

            // This is equivalent to pruning proposals that change to the same pitch
            //   at the same time.

            let mut proposal_ids_to_keep: Vec<usize> = Vec::new();
            let mut best_transitions: HashMap<usize, (f32, usize)> = HashMap::new();

            for (i, proposal) in proposals[frame].iter().enumerate() {
                // Carry over contours that didn't change pitch (can't be ruled out)
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

            // print(f'{len(proposal_ids_to_keep)} '
            //       'proposals remain after deduping')

            proposal_ids_to_keep.sort_by(|i, j| {
                proposals[frame][*i]
                    .score
                    .partial_cmp(&proposals[frame][*j].score)
                    .unwrap()
            });

            proposal_ids_to_keep = proposal_ids_to_keep[0..ff_config::BEAM_WIDTH].to_vec();
            let mut proposal_ids_to_keep_hash: HashSet<usize> = HashSet::new();
            for pid in proposal_ids_to_keep {
                proposal_ids_to_keep_hash.insert(pid);
            }

            let kept_proposals: Vec<Proposal> = proposals[frame]
                .into_iter()
                .enumerate()
                .filter(|(i, p)| proposal_ids_to_keep.contains(i))
                .map(|(i, p)| p)
                .collect();
            proposals[frame] = kept_proposals;

            // best_proposals = [proposals[frame][i] for i in best_proposals]
            let best_proposals: Vec<Proposal> = proposal_ids_to_keep
                .iter()
                .map(|i| proposals[frame][*i])
                .collect();
            proposals[frame] = best_proposals

            // print('deduping', num_frames * 1000 * (dt() - start))

            // print(f'{len(proposals[frame])} '
            //       f'proposals computed for frame {frame}')
        }

        // ===============================
        // === Retrace through lattice ===
        // ===============================

        let best_final_proposal: Proposal = *proposals[proposals.len() - 1]
            .iter()
            .max_by(|p1, p2| p1.score.partial_cmp(&p2.score).unwrap())
            .unwrap();
        let contour_proposals: Vec<Proposal> = vec![best_final_proposal];

        let mut frame: usize = num_frames - 2;
        while frame > 0 {
            let prev_prop = proposals[frame][contour_proposals[0].prev_proposal_id];
            contour_proposals.insert(0, prev_prop);
            frame -= 1;
        }

        let contour: Vec<u32> = contour_proposals.iter().map(|p| p.pitch as u32).collect();

        return (contour, best_final_proposal.score);
    }

    fn compute_new_proposal(
        &self,
        prev_proposal: &Proposal,
        prev_proposal_id: usize,
        pitch: usize,
        energy: f32,
        tempo_score: &f32,
    ) -> Proposal {
        // Compute a proposal at time t given the proposal and proposal id at time
        //  t-1, the pitch at time t, and the spectral energy at that pitch and
        //  time.

        let mut new_score = prev_proposal.score;
        new_score += energy;

        let interval = pitch as i32 - prev_proposal.pitch as i32;
        let pitch_changed: bool = interval != 0;
        let duration: usize;

        if pitch_changed {
            // This is the seem for each value of the inner loop that calls this
            //   function. This is a performance optimisation.
            new_score += tempo_score;
            new_score += self.pitch_model.score_pitch_interval(&interval);
            duration = 1;
        } else {
            duration = prev_proposal.duration + 1;
        }

        return Proposal {
            prev_proposal_id,
            pitch,
            score: new_score,
            duration,
            pitch_changed,
        };
    }
}
