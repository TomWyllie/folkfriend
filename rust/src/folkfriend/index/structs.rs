use serde::{Deserialize, Serialize};
use std::collections;

#[derive(Serialize, Deserialize, Debug)]
pub struct TuneIndex {
    pub settings: TuneSettings,
    pub aliases: TuneAliases,
}

pub type TuneSettings = collections::HashMap<u32, Setting>;
pub type TuneAliases = collections::HashMap<u32, Vec<String>>;

#[derive(Serialize, Deserialize, Debug)]
pub struct Setting {
    pub tune_id: u32,
    pub name: String,
    pub meter: String,
    pub mode: String,
    pub abc: String,
    pub dance: String,
    pub contour: String,
}
