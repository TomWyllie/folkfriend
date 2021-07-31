mod folkfriend;
mod dataset;

use crate::folkfriend::index::structs::*;

use clap::{Arg, App};

fn main() {

    let args = App::new("FolkFriend")
        .version("3.0")
        .author("T.C. Wyllie <tom@wyllie.dev>")
        .about("Transcription and recognition of traditional instrumental folk music")
        .subcommand(App::new("dataset")
            .arg(Arg::new("dataset-op")
                .possible_values(&["transcribe", "query"])
                .required(true)
            )
            .arg(Arg::new("dataset-path")
                .required(true)
                .default_value("/home/tom/datasets/tiny-folkfriend-evaluation-dataset/")
            )
        )
        .get_matches();
        
    if let Some(ref args) = args.subcommand_matches("dataset") {

        let dataset_path = args.value_of("dataset-path").unwrap();
        let dataset_op = args.value_of("dataset-op").unwrap();

        match dataset_op {
            "transcribe" => { println!("transcribing") },
            "query" => { bulk_query(dataset_path) },
            _ => {},
        }
    }

    // folkfriend::index::load::load_from_path();

    // let example_seq = [1, 2, 3, 4, 5, 6, 7, 8].to_vec();
    // let trigrams = heuristic_search::trigrams(&example_seq);
    // println!("{:?}", trigrams);

    // run_nw_aligner();
}

fn bulk_query(dataset_path: &str) {
    let transcriptions = dataset::load_transcriptions(&dataset_path).unwrap(); 
    let tune_index = folkfriend::index::load::load_from_path();
    let tune_settings: TuneSettings = tune_index.settings;
    // let bulk_output: Vec<dataset::TranscriptionRecordRanked> = Vec::new();

    for transcription in transcriptions {
        let query = transcription.transcription;
        let ranked_settings = folkfriend::query::run_query(&query, &tune_settings);

        for (i, (setting_id, _)) in ranked_settings.iter().enumerate() {
            let tune_id = tune_settings[setting_id].tune_id;
            if tune_id == transcription.tune_id {
                println!("{}", i);
                break;
            }
        }
    }
}

// fn run_nw_aligner() {
//     use std::time::Instant;
//     let now = Instant::now();
//     //  1.0
//     println!(
//         "{}",
//         needleman_wunsch([1, 2, 3, 4, 5].to_vec(), [1, 2, 3, 4, 5].to_vec())
//     );

//     // 1.0
//     println!(
//         "{}",
//         needleman_wunsch([1, 2, 3, 4, 5].to_vec(), [1, 2, 3, 4, 5, 6, 6, 6].to_vec())
//     );

//     //  0.6 (-2 for mismatch, +8)
//     println!(
//         "{}",
//         needleman_wunsch([1, 2, 3, 4, 5].to_vec(), [1, 2, 8, 4, 5].to_vec())
//     );
//     //  0.7 (-1 for edge gap, +8)
//     println!(
//         "{}",
//         needleman_wunsch([1, 2, 3, 4, 5].to_vec(), [3, 2, 3, 4, 5].to_vec())
//     );

//     // Benchmarking
//     for _ in 0..100 {
//         needleman_wunsch(
//             [5, 0, 3, 7, 4, 9, 3, 6, 0, 0, 8, 6, 7, 9, 7, 10, 5, 10, 4, 9].to_vec(),
//             [
//                 9, 1, 0, 7, 0, 7, 6, 4, 2, 3, 8, 4, 5, 8, 9, 5, 3, 10, 8, 7, 0, 8, 7, 6, 4, 10, 3,
//                 8, 3, 3, 0, 3, 7, 0, 10, 3, 10, 8, 3, 4, 2, 9, 2, 3, 3, 6, 10, 5, 10, 3, 1, 7, 6,
//                 7, 0, 7, 7, 5, 4, 0, 0, 3, 0, 10, 7, 2, 6, 5, 3, 0, 3, 5, 1, 10, 3, 1, 7, 2, 6, 7,
//                 0, 5, 1, 3, 8, 8, 3, 10, 6, 0, 10, 7, 8, 2, 8, 3, 5, 0, 7, 4,
//             ]
//             .to_vec(),
//         );
//     }

//     let elapsed = now.elapsed();
//     println!("Elapsed: {:.2?}", elapsed);
// }
