extern crate folkfriend;

use clap::{App, Arg};
use dirs;
use folkfriend::FolkFriend;
use image;
use indicatif::{ProgressBar, ProgressStyle};
use rayon::prelude::*;
use reqwest;
use std::fs;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use wav;

fn main() {
    let matches = App::new("FolkFriend")
        .version(folkfriend::ff_config::VERSION)
        .author("T.C. Wyllie <tom@wyllie.dev>")
        .about("Transcription and recognition of traditional instrumental folk music")
        .arg(Arg::with_name("command").required(true).possible_values(&[
            "transcribe",
            "query",
            "name",
        ]))
        .arg(Arg::with_name("input").required(true))
        .arg(
            Arg::with_name("debug")
                .short("d")
                .long("debug")
                .required(false)
                .takes_value(false)
                .help("Write out PNG files showing intermediate steps of transcription"),
        )
        .get_matches();

    let command = matches.value_of("command").unwrap();
    let input = matches.value_of("input").unwrap().to_string();
    let debug = matches.is_present("debug");

    let mut ff = FolkFriend::new();
    let tune_index_json = get_tune_index_json();
    ff.load_index_from_json_string(tune_index_json);

    let now = Instant::now();

    if command == "name" {
        name_query(ff, input);
    } else if command == "transcribe" {
        process_audio_files(ff, input, false, debug);
    } else if command == "query" {
        process_audio_files(ff, input, true, debug);
    }

    eprintln!("FolkFriend command finished in {:.2?}", now.elapsed());
}

fn process_audio_files(ff: FolkFriend, input: String, with_transcription_query: bool, debug: bool) {
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
    let mut progress: Option<ProgressBar> = None;

    if audio_file_paths.len() > 1 {
        let bar = ProgressBar::new(audio_file_paths.len() as u64);
        bar.set_message("Processing audio files");
        bar.set_style(ProgressStyle::default_bar().template(
            "[{msg} {elapsed_precise}]  {wide_bar}  {pos}/{len}  [{per_sec}, ETA {eta_precise}]",
        ));
        progress = Some(bar);
    }

    let skipped_files: Vec<String> = Vec::new();
    let skipped_files = Arc::new(Mutex::new(skipped_files));

    audio_file_paths.par_iter().for_each(|audio_file_path| {
        if let Some(bar) = &progress {
            bar.inc(1);
        }

        if !audio_file_path.ends_with(".wav") {
            skipped_files
                .lock()
                .unwrap()
                .push(format!("Skipped non .wav file `{}`", audio_file_path));
            return;
        }
        let wav_path;
        if input_is_csv {
            let csv_dir = Path::new(&input).parent().unwrap();
            wav_path = csv_dir.join(Path::new(&audio_file_path));
        } else {
            wav_path = Path::new(&audio_file_path).to_path_buf();
        }
        let base_debug_path = wav_path.as_path().display().to_string().replace(".wav", "");

        let (signal, sample_rate) = pcm_signal_from_wav(&wav_path);
        // The FolkFriend struct is not set up for happy concurrency.
        //  To avoid the unecessary complication of mutex etc, we just
        //  bypass the higher level wrapper.
        let mut fe = folkfriend::feature::FeatureExtractor::new(sample_rate);
        let feature_decoder = folkfriend::decode::FeatureDecoder::new(sample_rate);

        fe.feed_signal(signal);

        if debug {
            let out_path = format!("{}.a-features.png", base_debug_path);
            save_features_as_img(&fe.features, &out_path);
        }

        // If there's an error, such as the decoder failing to find any notes,
        //  we can't just gloss over it and pretend we never saw this audio
        //  file. Continue with an empty string as the contour. The results
        //  be terrible but that's fair if we couldn't find any notes.
        let lattice_path = feature_decoder
            .decode_lattice_path(&mut fe.features)
            .unwrap_or(folkfriend::decode::types::LatticePath::new());
        let contour_string = feature_decoder.decode_contour(&lattice_path, &fe.features).unwrap_or("".to_string());

        if debug {
            if lattice_path.len() > 0 {
                let out_path = format!("{}.b-lattice-path.png", base_debug_path);
                save_lattice_path_as_img(&lattice_path, &out_path);
            }

            let contour = folkfriend::decode::types::contour_string_to_contour(&contour_string);
            if contour.len() > 0 {
                let out_path = format!("{}.c-decoded-contour.png", base_debug_path);
                save_contour_as_img(&contour, &out_path);
            }
        }

        if !with_transcription_query {
            println!("=== Transcription for file {:?} ===", audio_file_path);
            println!("Midi sequence: {:?}", contour_string);
            println!("ABC: {:?}", &ff.contour_to_abc(&contour_string));
            return;
        }

        let results = &ff
            .run_transcription_query(&contour_string)
            .expect("Transcription query failed");
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
    });

    if let Some(bar) = progress {
        bar.finish();
    }

    for skipped_file in skipped_files.lock().unwrap().iter() {
        eprintln!("{}", skipped_file);
    }

    // let decoder = folkfriend::decode::FeatureDecoder::new();
    // debug_features::save_features_as_img(&fe.features, &"debug-a.png".to_string());
    // debug_features::save_contour_as_img(&contour, &"debug-b.png".to_string());
}

fn pcm_signal_from_wav(wav_file_path: &PathBuf) -> (Vec<f32>, u32) {
    let mut inp_file = File::open(Path::new(&wav_file_path)).unwrap();
    let (header, data) = wav::read(&mut inp_file).unwrap();

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
    // let index_url = "https://raw.githubusercontent.com/TomWyllie/folkfriend-app-data/master/folkfriend-non-user-data.json";
    let index_url = "https://folkfriend-app-data.web.app/folkfriend-non-user-data.json";
    if !folkfriend_index.exists() {
        let resp = reqwest::blocking::get(index_url).unwrap().text().unwrap();
        fs::write(&folkfriend_index, resp).expect("Couldn't write data to index file");
    }

    let data = fs::read_to_string(folkfriend_index).expect("Couldn't read index");
    return data;
}

pub fn save_features_as_img(features: &folkfriend::feature::types::Features, path: &String) {
    let imgx = features.len() as u32;
    let imgy = folkfriend::ff_config::MIDI_NUM;
    let mut imgbuf = image::ImageBuffer::new(imgx, imgy);

    let max = features
        .iter()
        .flatten()
        .max_by(|a, b| a.partial_cmp(b).expect("NaN"))
        .unwrap();

    // Iterate over the coordinates and pixels of the image
    for (x, y, pixel) in imgbuf.enumerate_pixels_mut() {
        let grey = (255. * features[x as usize][(imgy - y - 1) as usize] / max) as u8;
        *pixel = image::Luma([grey]);
    }

    // Save the image
    imgbuf.save(path).unwrap();
}

pub fn save_contour_as_img(contour: &folkfriend::decode::types::Contour, path: &String) {
    let imgx = 8 * contour.len() as u32;
    let imgy = folkfriend::ff_config::MIDI_NUM;
    let mut imgbuf = image::ImageBuffer::new(imgx, imgy);

    for x in 0..imgx {
        let contour_ind = (x as f32 / 8.0).floor() as usize;
        let pitch = contour[contour_ind];
        let y = imgy - 1 - (pitch as u32 - folkfriend::ff_config::MIDI_LOW);
        imgbuf.put_pixel(x as u32, y, image::Luma([255 as u8]));
    }

    // Save the image
    imgbuf.save(path).unwrap();
}

pub fn save_lattice_path_as_img(lattice_path: &folkfriend::decode::types::LatticePath, path: &String) {
    let imgx = lattice_path.len() as u32;
    let imgy = folkfriend::ff_config::MIDI_NUM;
    let mut imgbuf = image::ImageBuffer::new(imgx, imgy);

    for (x, lattice_index) in lattice_path.iter().enumerate() {
        let y = folkfriend::ff_config::MIDI_NUM - 1 - *lattice_index as u32;
        imgbuf.put_pixel(x as u32, y, image::Luma([255 as u8]));
    }

    // Save the image
    imgbuf.save(path).unwrap();
}