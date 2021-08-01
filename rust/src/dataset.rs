use std::path::Path;
use std::error::Error;

use std::fs;
use csv;

use serde::{Serialize, Deserialize};

pub type Transcriptions = Vec<TranscriptionRecord>;

#[derive(Debug, Deserialize)]
pub struct TranscriptionRecord {
    pub rel_path: String,
    pub tune_id: u32,
    pub name: String,
    pub transcription: String,

}

#[derive(Debug, Serialize)]
pub struct TranscriptionRecordRanked {
    pub rel_path: String,
    pub tune_id: u32,
    pub name: String,
    pub transcription: String,
    pub rank: usize,
}

pub fn load_transcriptions(dataset_path: &str) -> Result<Transcriptions, csv::Error> {
    let dataset_path = Path::new(dataset_path);
    let transcriptions_path = Path::new("transcriptions.csv");
    let transcriptions_path = dataset_path.join(transcriptions_path);

    let data = fs::read_to_string(transcriptions_path).expect("Couldn't read file");

    let mut reader = csv::Reader::from_reader(data.as_bytes());
    let mut transcriptions: Transcriptions = Vec::new();

    for result in reader.deserialize() {
        let record: TranscriptionRecord = result?;
        transcriptions.push(record);
    }

    return Ok(transcriptions);
}

pub fn write_transcriptions_ranked(dataset_path: &str, transcriptions_ranked: Vec<TranscriptionRecordRanked>) -> Result<(), Box<dyn Error>> {

    let dataset_path = Path::new(dataset_path);
    let rankings_path = Path::new("rankings.csv");
    let rankings_path = dataset_path.join(rankings_path);
    
    let mut wtr = csv::Writer::from_path(rankings_path)?;

    for transcription_ranked in transcriptions_ranked {
        wtr.serialize(transcription_ranked)?;
    }

    wtr.flush()?;
    Ok(())
}