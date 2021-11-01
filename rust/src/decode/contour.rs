use crate::decode::types::{Contour, LatticeIndex, LatticePath, Pitch};
use crate::decode::DecoderError;
use crate::feature::types::Features;
use crate::ff_config;

#[derive(Debug)]
struct Note {
    pitch: Pitch,
    duration: usize,
    // Power = total energy / duration
    power: f32,
}
type Notes = Vec<Note>;

#[derive(Debug)]
struct QuantisedNote {
    pitch: Pitch,
    quavers_exact: f32,
    quavers_quant: usize,
    power: f32,
}
type QuantisedNotes = Vec<QuantisedNote>;

pub fn contour_from_lattice_path(
    lattice_path: &LatticePath,
    features: &Features,
    sample_rate: u32,
) -> Result<Contour, DecoderError> {
    if lattice_path.len() == 0 {
        return Err(DecoderError);
    }
    let mut notes = notes_from_lattice_path(lattice_path, features)?;
    let contour = contour_from_notes(&mut notes, sample_rate)?;
    return Ok(contour);
}

fn notes_from_lattice_path(
    lattice_path: &LatticePath,
    features: &Features,
) -> Result<Notes, DecoderError> {
    let mut notes: Vec<Note> = Vec::new();

    let mut prev_pitch = lattice_ind_to_pitch(&lattice_path[0]);
    let mut prev_dur: usize = 1;
    let mut prev_energy: f32 = 0.;

    for (i, lattice_index) in lattice_path.iter().enumerate() {
        let pitch = lattice_ind_to_pitch(&lattice_index);
        if pitch == prev_pitch {
            prev_dur += 1;
            prev_energy += features[i][*lattice_index];
        } else {
            notes.push(Note {
                pitch: prev_pitch,
                duration: prev_dur,
                power: prev_energy / prev_dur as f32,
            });
            prev_pitch = pitch;
            prev_dur = 1;
            prev_energy = features[i][*lattice_index];
        }
    }

    return Ok(notes);
}

fn contour_from_notes(notes: &mut Notes, sample_rate: u32) -> Result<Contour, DecoderError> {
    // Filter out very short events and very weak events.
    notes.retain(|note| {
        note.power > ff_config::MIN_NOTE_POWER && note.duration >= ff_config::MIN_NOTE_DURATION
    });

    // There may be no events left (all silence = all low power = all removed),
    //  or only very few. If there's only 2 or 3 notes found we say there was
    //  no music heard.
    if notes.len() <= 3 {
        return Err(DecoderError);
    }

    // We now attempt to convert this filtered sequence of notes into a contour,
    //  which is a sequence of pitches all of which are the same length. We use
    //  different tempos to generate many different candidates, and score the
    //  likelihood of each tempo by considering the quantisation error introduced
    //  by having all notes the same duration, and the probability of a sequence
    //  of note of that duration (e.g. 10 quavers in a row is quite likely, 10
    //  minums in a row is far less likely). We generally find the solution where
    //  one quaver corresponds to one note in the contour, which is a fair
    //  approximation for the overwhelming majority of folk tunes.
    let low_bpm = 60;
    let high_bpm = 240;

    let mut best_tempo: (u32, f32, QuantisedNotes) =
        (low_bpm, -f32::INFINITY, QuantisedNotes::new());

    for bpm in (low_bpm..high_bpm).step_by(5) {
        let frames_per_quaver = bpm_to_num_frames(bpm, sample_rate);
        let quantised_notes = quantise_notes(&notes, frames_per_quaver)?;
        let score = score_quantised_notes(&quantised_notes, &notes, frames_per_quaver);
        if score > best_tempo.1 {
            best_tempo = (bpm, score, quantised_notes);
        }
    }

    let best_quantised_notes = best_tempo.2;
    let mut contour = Contour::new();
    for q_note in best_quantised_notes.iter() {
        contour.extend(vec![q_note.pitch; q_note.quavers_quant]);
    }

    return Ok(contour);
}

fn quantise_notes(notes: &Notes, frames_per_quaver: f32) -> Result<QuantisedNotes, DecoderError> {
    let mut quantised_notes: QuantisedNotes = Vec::new();

    for note in notes.iter() {
        // Simply choose nearest whole number of quavers.
        //   But be more lenient to giving each least one.
        let exact_quavers: f32 = note.duration as f32 / frames_per_quaver;
        let mut quant_quavers: u32 = 0;
        if exact_quavers > 0.2 {
            quant_quavers = f32::max(1.0, exact_quavers.round()) as u32;
        }
        quantised_notes.push(QuantisedNote {
            pitch: note.pitch,
            quavers_exact: exact_quavers,
            quavers_quant: quant_quavers as usize,
            power: note.power,
        })
    }

    if quantised_notes.len() == 0 {
        return Err(DecoderError);
    }

    return Ok(quantised_notes);
}

fn score_quantised_notes(
    quantised_notes: &QuantisedNotes,
    notes: &Notes,
    frames_per_quaver: f32,
) -> f32 {
    let num_input_frames: f32 = notes.iter().map(|note| note.duration as f32).sum();
    let quant_output_frames: f32 = quantised_notes
        .iter()
        .map(|note| note.quavers_quant as f32 * frames_per_quaver)
        .sum();
    // What is the quantisation error? Scale this by power
    //   so quantisation error is more important on stronger
    //   notes.
    let quant_error: f32 = quantised_notes
        .iter()
        .map(|q_note| (q_note.quavers_exact - q_note.quavers_quant as f32).abs() * q_note.power)
        .sum();

    // Normalise score to [0, 1]. This score represents how well the quantisation of
    //  each individual note accounts for the original note length. 1.0 = perfect.
    let quant_score = 1.0 - quant_error * frames_per_quaver / num_input_frames;

    // Now find the quantisation error from the overall change in length.
    let overall_temporal_score =
        1.0 - (num_input_frames - quant_output_frames).abs() / num_input_frames;

    // We use a very simple model of how many notes we expect to see before
    //   the note changes (ie the distribution of values of quantError).
    // Note that this linear model is actually surprisingly close to reality,
    //  modelling the log likelihood which decreases logarithmically with a
    //  nearly constant exponent coefficient on length. (ie the number of
    //  occurrences of [1, 2, 3, 4, 5, 6, 7, 8] notes in the output file
    //  closely follows a single exponentially decreasing function. As we
    //  consider the output probability as the product of the individual
    //  probabilities the log likelihood is therefore roughly a sum of these
    //  notes
    let mut probability_model_score: f32 = quantised_notes
        .iter()
        // Linear model of log likelihood of notes of different duration
        .map(|q_note| 3.0 - 0.5 * q_note.quavers_quant as f32)
        .sum();

    // Normalise by number of quantised quavers, otherwise there's a
    //   bias towards shorter tempos which have more positive scores.
    probability_model_score /= quantised_notes.len() as f32;

    return probability_model_score * overall_temporal_score * quant_score;
}

pub fn bpm_to_num_frames(bpm: u32, sample_rate: u32) -> f32 {
    // Convert a BPM tempo into a float of frames per quaver
    let bps = bpm as f32 / 60.;
    let quavers_per_sec = bps * 2.0; // Quaver = half a crotchet
    let frames_per_sec = sample_rate as f32 / ff_config::SPEC_WINDOW_SIZE as f32;
    return frames_per_sec / quavers_per_sec; // Frames per quaver
}

pub fn lattice_ind_to_pitch(li: &LatticeIndex) -> Pitch {
    return ff_config::MIDI_LOW + *li as u32;
}

// #[cfg(test)]
// mod tests {
//     use super::*;

//     #[test]
//     fn test_empty_lattice_path() {
//         let lp = LatticePath::new();
//         let ft = Features::new();
//         assert!(contour_from_lattice_path(&lp, &ft).is_err());
//     }
// }
