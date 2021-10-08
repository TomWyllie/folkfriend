use serde::{Deserialize, Serialize};
use std::collections;

pub type TuneSettings = collections::HashMap<u32, Setting>;
pub type TuneAliases = collections::HashMap<u32, Vec<String>>;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Setting {
    pub tune_id: u32,
    pub meter: String,
    pub mode: String,
    pub abc: String,
    pub dance: String,
    pub contour: String,
}
