mod heuristic;
mod nw;

use crate::folkfriend::decode;
use crate::folkfriend::ff_config;
use crate::folkfriend::index::schema::*;
use crate::folkfriend::index::TuneIndex;

use std::collections::HashMap;
use std::fmt;

use std::time::Instant;

pub struct QueryEngine {
    pub tune_index: Option<TuneIndex>,
    heuristic_aliases_feats: heuristic::AliasFeats,
    heuristic_settings_feats: heuristic::SettingsFeats,
    num_repass: usize,
    num_output: usize,
}

#[derive(Debug)]
pub struct TranscriptionQueryRecord<'a> {
    pub setting: &'a Setting,
    pub score: f32,
}

#[derive(Debug)]
pub struct NameQueryRecord<'a> {
    pub setting: &'a Setting,
    pub display_name: &'a String,
}

pub type TranscriptionQueryResults<'a> = Vec<TranscriptionQueryRecord<'a>>;
pub type NameQueryResults<'a> = Vec<NameQueryRecord<'a>>;

impl QueryEngine {
    pub fn new() -> QueryEngine {
        QueryEngine {
            tune_index: None,
            heuristic_aliases_feats: HashMap::new(),
            heuristic_settings_feats: HashMap::new(),
            num_repass: 2000,
            num_output: 100,
        }
    }

    pub fn use_tune_index(mut self: Self, tune_index: TuneIndex) -> QueryEngine {
        self.heuristic_aliases_feats = heuristic::build_aliases_feats(&tune_index.aliases);
        self.heuristic_settings_feats = heuristic::build_settings_feats(&tune_index.settings);
        self.tune_index = Some(tune_index);
        self // Return ownership. (I think this is how it works in rust, and sensible???)
    }

    pub fn run_contour_query(
        self: &Self,
        contour: &decode::types::Contour,
    ) -> Result<TranscriptionQueryResults, QueryError> {
        match &self.tune_index {
            None => Err(QueryError),
            Some(tune_index) => {

                // === Heuristic search ===
                let nowh = Instant::now();
                
                // Convert 'contour' to a string to use as a query.
                let query = query_string_from_contour(contour);
                
                // First pass: fast, but inaccurate. Good for eliminating many poor candidates.
                let first_search =
                heuristic::run_transcription_query(&query, &self.heuristic_settings_feats);
                
                eprintln!("Heuristic search took {:.2?}", nowh.elapsed());
                
                // === Full search ===
                let nowf = Instant::now();
                
                // Second pass: slow, but accurate. Good for refining a shortlist of candidates.
                let mut second_search: Vec<(u32, f32)> = Vec::new();
                for (setting_id, _) in &first_search[0..self.num_repass] {
                    let score =
                    nw::needleman_wunsch(&query, &tune_index.settings[setting_id].contour);
                    second_search.push((*setting_id, score));
                }
                let mut sorted_rankings: Vec<_> = second_search.into_iter().collect();
                sorted_rankings.sort_by(|x, y| y.1.partial_cmp(&x.1).unwrap());
                let mut results: TranscriptionQueryResults = Vec::new();
                for (setting_id, score) in sorted_rankings[0..self.num_output].iter() {
                    let setting = &tune_index.settings[setting_id];
                    results.push(TranscriptionQueryRecord {
                        setting: setting,
                        score: *score,
                    });
                }
                
                eprintln!("Full search took {:.2?}", nowf.elapsed());
                
                Ok(results)
            }
        }
    }

    pub fn run_name_query(self: &Self, query: &String) -> Result<NameQueryResults, QueryError> {
        match &self.tune_index {
            None => Err(QueryError),
            Some(tune_index) => Ok(heuristic::run_name_query(
                query,
                tune_index,
                &self.heuristic_aliases_feats,
            )),
        }
    }
}

pub fn query_string_from_contour(contour: &decode::types::Contour) -> String {
    contour
        .iter()
        .map(|midi| ff_config::CONTOUR_TO_QUERY_CHAR[(midi - ff_config::MIDI_LOW) as usize])
        .collect()
}

pub struct QueryError;

impl fmt::Debug for QueryError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "query engine has not loaded index")
    }
}
