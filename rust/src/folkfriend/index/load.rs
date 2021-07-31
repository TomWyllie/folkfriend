use serde_json;
use std::fs;

use super::structs::{TuneIndex};

pub fn load_from_path() -> TuneIndex {
    let path = "/home/tom/repos/folkfriend/scripts/index-builder/index-data/folkfriend-non-user-data.json";
    let data = fs::read_to_string(path).expect("Couldn't read file");
    let tune_index: TuneIndex = serde_json::from_str(&data).expect("Couldn't parse file");
    return tune_index;
}