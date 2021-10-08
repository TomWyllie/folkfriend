mod heuristic;
mod nw;

use crate::decode;
use crate::index::schema::*;
use crate::index::TuneIndex;

use fnv::FnvHashSet as HashSet;
use std::collections::HashMap;
use std::fmt;

use std::time::Instant;

pub struct QueryEngine {
    pub tune_index: Option<TuneIndex>,
    setting_ids_by_tune_id: HashMap<u32, Vec<u32>>,
    heuristic_aliases_feats: heuristic::AliasFeats,
    heuristic_settings_feats: heuristic::SettingsFeats,
    num_repass: usize,
    num_output: usize,
}

#[derive(Debug)]
pub struct TranscriptionQueryRecord {
    pub setting: Setting,
    pub display_name: String,
    pub score: f32,
}

#[derive(Debug)]
pub struct NameQueryRecord {
    pub setting: Setting,
    pub display_name: String,
}

pub type TranscriptionQueryResults = Vec<TranscriptionQueryRecord>;
pub type NameQueryResults = Vec<NameQueryRecord>;

impl QueryEngine {
    pub fn new() -> QueryEngine {
        QueryEngine {
            tune_index: None,
            setting_ids_by_tune_id: HashMap::new(),
            heuristic_aliases_feats: HashMap::new(),
            heuristic_settings_feats: HashMap::new(),
            num_repass: 2000,
            num_output: 100,
        }
    }

    pub fn use_tune_index(&mut self, tune_index: TuneIndex) {
        let now = Instant::now();
        self.heuristic_aliases_feats = heuristic::build_aliases_feats(&tune_index.aliases);
        self.heuristic_settings_feats = heuristic::build_settings_feats(&tune_index.settings);
        // Build tune-IDs to setting-IDs map
        let mut setting_ids_by_tune_id: HashMap<u32, Vec<u32>> = HashMap::new();
        for (setting_id, setting) in &tune_index.settings {
            setting_ids_by_tune_id
                .entry(setting.tune_id)
                .or_insert(Vec::new())
                .push(*setting_id);
        }

        for (_, setting_ids) in setting_ids_by_tune_id.iter_mut() {
            setting_ids.sort()
        }

        self.setting_ids_by_tune_id = setting_ids_by_tune_id;
        self.tune_index = Some(tune_index);
        eprintln!("Loaded tune index in {:.2?}", now.elapsed());
    }

    pub fn run_contour_query(
        self: &Self,
        contour: &decode::types::ContourString,
    ) -> Result<TranscriptionQueryResults, QueryError> {
        match &self.tune_index {
            None => Err(QueryError),
            Some(tune_index) => {
                // === Heuristic search ===
                let nowh = Instant::now();
                
                // First pass: fast, but inaccurate. Good for eliminating many poor candidates.
                let first_search =
                    heuristic::run_transcription_query(&contour, &self.heuristic_settings_feats);
                eprintln!("Heuristic search took {:.2?}", nowh.elapsed());
                // === Full search ===
                let nowf = Instant::now();
                // Second pass: slow, but accurate. Good for refining a shortlist of candidates.
                let mut second_search: Vec<(u32, f32)> = Vec::new();
                for (setting_id, _) in &first_search[0..self.num_repass] {
                    let score =
                        nw::needleman_wunsch(&contour, &tune_index.settings[setting_id].contour);
                    second_search.push((*setting_id, score));
                }
                let mut sorted_rankings: Vec<_> = second_search.into_iter().collect();
                sorted_rankings.sort_by(|x, y| y.1.partial_cmp(&x.1).unwrap());
                let mut results: TranscriptionQueryResults = Vec::new();

                let mut tune_ids_in_results: HashSet<u32> = HashSet::default();

                for (setting_id, score) in sorted_rankings.iter() {
                    let setting = &tune_index.settings[setting_id];
                    if tune_ids_in_results.contains(&setting.tune_id) {
                        continue;
                    }

                    tune_ids_in_results.insert(setting.tune_id);
                    results.push(TranscriptionQueryRecord {
                        setting: setting.clone(),
                        score: *score,
                        display_name: tune_index.aliases.get(&setting.tune_id).unwrap()[0].clone(),
                    });

                    if results.len() >= self.num_output {
                        break;
                    }
                }
                eprintln!("Full search took {:.2?}", nowf.elapsed());
                Ok(results)
            }
        }
    }

    pub fn run_name_query(self: &Self, query: &String) -> Result<NameQueryResults, QueryError> {
        match &self.tune_index {
            None => Err(QueryError),
            Some(tune_index) => {
                let mut scored_names: Vec<heuristic::ScoredName> =
                    heuristic::run_name_query(query, &self.heuristic_aliases_feats);

                scored_names.sort_unstable_by(|a, b| match b.ngram_score.cmp(&a.ngram_score) {
                    std::cmp::Ordering::Less => std::cmp::Ordering::Less,
                    std::cmp::Ordering::Greater => std::cmp::Ordering::Greater,
                    std::cmp::Ordering::Equal => {
                        let a_alias_len =
                            &tune_index.aliases.get(&a.tune_id).unwrap()[a.alias_index].len();
                        let b_alias_len =
                            &tune_index.aliases.get(&b.tune_id).unwrap()[b.alias_index].len();
                        return a_alias_len.cmp(&b_alias_len);
                    }
                });

                let mut tune_ids_in_results: HashSet<u32> = HashSet::default();

                let top_scores: NameQueryResults = scored_names
                    .iter()
                    .filter(|t| tune_ids_in_results.insert(t.tune_id))
                    .take(20)
                    .map(|t| {
                        NameQueryRecord {
                            // TODO safer checks in index builder that there can
                            //  never be an alias without a corresponding setting
                            setting: tune_index
                                .settings
                                .get(&self.setting_ids_from_tune_id(t.tune_id).unwrap()[0])
                                .unwrap()
                                .clone(),
                            display_name: tune_index.aliases.get(&t.tune_id).unwrap()
                                [t.alias_index].clone(),
                        }
                    })
                    .collect();

                return Ok(top_scores);
            }
        }
    }

    pub fn setting_ids_from_tune_id(&self, tune_id: u32) -> Option<&Vec<u32>> {
        self.setting_ids_by_tune_id.get(&tune_id)
    }
}

pub struct QueryError;

impl fmt::Debug for QueryError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "query engine has not loaded index")
    }
}
