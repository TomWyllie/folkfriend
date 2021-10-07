use serde_json;
pub mod schema;

use serde::{Deserialize, Serialize};
use schema::{TuneAliases, TuneSettings};


#[derive(Serialize, Deserialize)] 
pub struct TuneIndex {
    pub settings: TuneSettings,
    pub aliases: TuneAliases,
}

pub fn tune_index_from_string(json_string: &String) -> TuneIndex {
    return serde_json::from_str(json_string).expect("Couldn't parse index");
}
