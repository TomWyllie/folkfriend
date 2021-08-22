mod dataset;
mod debug_features;
mod folkfriend;

use crate::folkfriend::index::structs::*;
use crate::folkfriend::sig_proc::spectrogram::*;
use clap::{App, Arg};
use indicatif::ProgressBar;
use rayon::prelude::*;
use std::convert::TryInto;
use std::fs::File;
use std::path::Path;
use std::time::Instant;
use wav;
use crate::folkfriend::ff_config;

fn main() {
    let now = Instant::now();

    let args = App::new("FolkFriend")
        .version("3.0")
        .author("T.C. Wyllie <tom@wyllie.dev>")
        .about("Transcription and recognition of traditional instrumental folk music")
        .subcommand(App::new("transcribe").arg(Arg::new("wav-file").required(true)))
        .subcommand(
            App::new("dataset")
                .arg(
                    Arg::new("dataset-op")
                        .possible_values(&["transcribe", "query"])
                        .required(true),
                )
                .arg(
                    Arg::new("dataset-path")
                        .required(true)
                        .default_value("/home/tom/datasets/tiny-folkfriend-evaluation-dataset/"),
                ),
        )
        .get_matches();

    if let Some(ref args) = args.subcommand_matches("dataset") {
        let dataset_path = args.value_of("dataset-path").unwrap().to_string();
        let dataset_op = args.value_of("dataset-op").unwrap();

        match dataset_op {
            "transcribe" => {
                println!("transcribing")
            }
            "query" => bulk_query(&dataset_path),
            _ => {}
        }
    }

    if let Some(ref args) = args.subcommand_matches("transcribe") {
        let audio_file_path = args.value_of("wav-file").unwrap().to_string();
        let mut inp_file = File::open(Path::new(&audio_file_path)).unwrap();
        let (header, data) = wav::read(&mut inp_file).unwrap();

        let mut fe =
            folkfriend::sig_proc::feature_extractor::FeatureExtractor::new(header.sampling_rate);
        let signal = data.try_into_sixteen().unwrap();
        let mut signal_f: Vec<f32> = vec![0.; signal.len()];

        for i in 0..signal.len() {
            signal_f[i] = (signal[i] as f32) / 65536.;
        }

        fe.feed_signal(signal_f);

        debug_features::save_features_as_img(&fe.features, &"debug-a.png".to_string());

        let decoder = folkfriend::decode::FeatureDecoder::new();
        
        let now2 = Instant::now();
        let contour = decoder.decode(fe.features);
        println!("(decoder finished in {:.2?})", now2.elapsed());
        
        debug_features::save_contour_as_img(&contour, &"debug-b.png".to_string());
        println!("{:?}", contour);
    }

    println!("FolkFriend finished in {:.2?}", now.elapsed());
}

fn bulk_query(dataset_path: &String) {
    let transcriptions = dataset::load_transcriptions(&dataset_path).unwrap();
    let tune_index = folkfriend::index::load::load_from_path();
    let tune_settings: TuneSettings = tune_index.settings;
    let query_engine = folkfriend::query::QueryEngine::new(tune_settings);
    let bar = ProgressBar::new(transcriptions.len().try_into().unwrap());

    let ranks: Vec<usize> = transcriptions
        .par_iter()
        .map(|transcription| {
            let query = &transcription.transcription;
            let ranked_settings = query_engine.run_query(query);
            let mut rank: usize = ranked_settings.len();

            for (i, (tune_id, _, _)) in ranked_settings.iter().enumerate() {
                if *tune_id == transcription.tune_id {
                    rank = i;
                    break;
                }
            }

            bar.inc(1);

            rank
        })
        .collect();
    let mut bulk_output: Vec<dataset::TranscriptionRecordRanked> = Vec::new();
    for (rank, transcription) in ranks.iter().zip(transcriptions) {
        let ranked = dataset::TranscriptionRecordRanked {
            rank: *rank,
            rel_path: transcription.rel_path,
            tune_id: transcription.tune_id,
            name: transcription.name,
            transcription: transcription.transcription,
        };
        bulk_output.push(ranked);
    }

    dataset::write_transcriptions_ranked(dataset_path, bulk_output).unwrap();

    bar.finish();
}
