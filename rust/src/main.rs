mod folkfriend;
mod dataset;

use crate::folkfriend::index::structs::*;
use indicatif::ProgressBar;
use std::convert::TryInto;
use std::time::Instant;
use clap::{Arg, App};    


fn main() {
    let now = Instant::now();

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
            
            let dataset_path = args.value_of("dataset-path").unwrap().to_string();
            let dataset_op = args.value_of("dataset-op").unwrap();
            
            match dataset_op {
            "transcribe" => { println!("transcribing") },
            "query" => { bulk_query(&dataset_path) },
            _ => {},
        }
    }
    
    println!("FolkFriend finished in {:.2?}", now.elapsed());
}

fn bulk_query(dataset_path: &String) {
    let transcriptions = dataset::load_transcriptions(&dataset_path).unwrap(); 
    let tune_index = folkfriend::index::load::load_from_path();
    let tune_settings: TuneSettings = tune_index.settings;
    let query_engine = folkfriend::query::QueryEngine::new(tune_settings);
    
    let mut bulk_output: Vec<dataset::TranscriptionRecordRanked> = Vec::new();

    let bar = ProgressBar::new(transcriptions.len().try_into().unwrap());

    for transcription in transcriptions {
        let query = &transcription.transcription;
        let ranked_settings = query_engine.run_query(query);
        let mut rank: usize = ranked_settings.len();

        for (i, (tune_id, _, _)) in ranked_settings.iter().enumerate() {
            if *tune_id == transcription.tune_id {
                rank = i;
                break;
            }
        }

        bulk_output.push(dataset::TranscriptionRecordRanked {
            rank: rank,
            rel_path: transcription.rel_path,
            tune_id: transcription.tune_id,
            name: transcription.name,
            transcription: transcription.transcription,
        });
        bar.inc(1);
    }

    dataset::write_transcriptions_ranked(dataset_path, bulk_output).unwrap();

    bar.finish();
}
