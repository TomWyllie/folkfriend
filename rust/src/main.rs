mod dataset;
mod debug_features;
mod folkfriend;

use folkfriend::FolkFriend;

use clap::{App, Arg};
// use indicatif::ProgressBar;
// use rayon::prelude::*;
use dirs;
use std::fs;
use std::fs::File;
use std::io::{BufRead, BufReader};
use reqwest;
use std::path::{Path, PathBuf};
use std::time::Instant;
use wav;

fn main() {
    let matches = App::new("FolkFriend")
        .version("3.0")
        .author("T.C. Wyllie <tom@wyllie.dev>")
        .about("Transcription and recognition of traditional instrumental folk music")
        .arg(
            Arg::new("command")
                .required(true)
                .possible_values(&["transcribe", "query", "name"]),
        )
        .arg(Arg::new("input").required(true))
        .get_matches();

    let command = matches.value_of("command").unwrap();
    let input = matches.value_of("input").unwrap().to_string();

    let mut ff = FolkFriend::new();
    let tune_index_json = get_tune_index_json();
    ff.load_index_from_json_string(tune_index_json);

    let now = Instant::now();

    if command == "name" {
        name_query(ff, input);
    } else if command == "transcribe" {
        process_audio_files(ff, input, false);
    } else if command == "query" {
        process_audio_files(ff, input, true);
    }

    eprintln!("FolkFriend command finished in {:.2?}", now.elapsed());
}

fn process_audio_files(mut ff: FolkFriend, input: String, with_transcription_query: bool) {
    // Load file paths from arguments / input CSV file
    let input_is_csv = input.ends_with(".csv");
    let audio_file_paths;

    if input.ends_with(".wav") {
        audio_file_paths = vec![input.clone()];
    } else if input_is_csv {
        audio_file_paths = get_audio_file_paths_from_csv(&input)
    } else {
        panic!(
            "Input path `{}` was invalid, please supply a .wav file, or a 
            .csv file of paths to .wav files",
            input
        )
    }

    let verbose: bool = { audio_file_paths.len() == 1 };

    // TODO set up parallelisation (single threaded at the moment)

    for audio_file_path in audio_file_paths {
        if !audio_file_path.ends_with(".wav") {
            eprintln!("Skipping non .wav file `{}`", audio_file_path);
            continue;
        }

        let wav_path;
        if input_is_csv {
            let csv_dir = Path::new(&input).parent().unwrap();
            wav_path = csv_dir.join(Path::new(&audio_file_path));
        } else {
            wav_path = Path::new(&audio_file_path).to_path_buf();
        }

        let (signal, sample_rate) = pcm_signal_from_wav(&wav_path);

        ff.set_sample_rate(sample_rate);
        ff.feed_entire_pcm_signal(signal);
        let contour = ff.transcribe_pcm_buffer();

        if !with_transcription_query {
            println!("=== Transcription for file {:?} ===", audio_file_path);
            println!("Midi sequence: {:?}", contour);
            println!("ABC: {:?}", ff.contour_to_abc(&contour));
            continue;
        }

        let results = ff
            .run_transcription_query(&contour)
            .expect("something failed");
        if verbose {
            println!("=== Query for file {:?} ===", audio_file_path);
            for result in results.iter().take(10) {
                println!(
                    "{:?}\t{:?}\t{:?}",
                    result.setting.tune_id, result.display_name, result.score
                );
            }
        } else {
            // This terse output is only designed to be used for analysing
            //  the folkfriend evaluation dataset and is not designed to be
            //  human-friendly. It's a CSV output of the tune IDs predicted
            //  by folkfriend, in order of most to least likely (and only
            //  the first 100 tunes thereof).
            let mut line_out = format!("{}", audio_file_path);

            for result in results {
                line_out.push_str(&format!(",{}", result.setting.tune_id));
            }

            println!("{}", line_out);
        }
    }

    // let decoder = folkfriend::decode::FeatureDecoder::new();
    // debug_features::save_features_as_img(&fe.features, &"debug-a.png".to_string());
    // debug_features::save_contour_as_img(&contour, &"debug-b.png".to_string());
}

fn pcm_signal_from_wav(wav_file_path: &PathBuf) -> (Vec<f32>, u32) {
    let mut inp_file = File::open(Path::new(&wav_file_path)).unwrap();
    let (header, data) = wav::read(&mut inp_file).unwrap();

    // let mut fe =
    //     folkfriend::feature::feature_extractor::FeatureExtractor::new(header.sampling_rate);
    let signal: Vec<i16> = data.try_into_sixteen().unwrap();

    let mut signal_f: Vec<f32> = vec![0.; signal.len()];
    for i in 0..signal.len() {
        signal_f[i] = (signal[i] as f32) / 32768.;
    }

    return (signal_f, header.sampling_rate);
}

fn get_audio_file_paths_from_csv(csv_path: &String) -> Vec<String> {
    let mut audio_file_paths = Vec::new();
    let file = File::open(csv_path).expect(&format!("File `{}` could not be opened", csv_path));
    let reader = BufReader::new(file);
    let mut lines: Vec<String> = reader
        .lines()
        .map(|l| l.expect("Could not parse line"))
        .collect();
    audio_file_paths.append(&mut lines);
    audio_file_paths
}

fn name_query(ff: FolkFriend, name: String) {
    let result = ff.run_name_query(&name).expect("Name query failed");

    for record in result {
        println!("{:?}\t\t{:?}", record.display_name, record.setting.tune_id);
    }
}

pub fn get_tune_index_json() -> String {
    
    let mut folkfriend_index: PathBuf = dirs::home_dir().unwrap();
    folkfriend_index.push(".folkfriend");
    std::fs::create_dir_all(&folkfriend_index).unwrap();

    folkfriend_index.push("folkfriend-non-user-data.json");
    let index_url = "https://raw.githubusercontent.com/TomWyllie/folkfriend-app-data/master/folkfriend-non-user-data.json";

    if !folkfriend_index.exists() {

        let resp = reqwest::blocking::get(index_url).unwrap().text().unwrap();
        fs::write(&folkfriend_index, resp).expect("Couldn't write data to index file");      
    }

    let data = fs::read_to_string(folkfriend_index).expect("Couldn't read index");
    return data;
}
