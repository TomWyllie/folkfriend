mod nw;
mod heuristic;

use crate::folkfriend::index::structs::*;

pub struct QueryEngine {
    tune_settings: TuneSettings,
    heuristic_settings_feats: heuristic::SettingsFeats,
    num_repass: usize,
    num_output: usize,
}

impl QueryEngine {
    pub fn new<'a>(tune_settings: TuneSettings) -> QueryEngine {
        QueryEngine {
            heuristic_settings_feats: heuristic::build_settings_feats(&tune_settings),
            tune_settings: tune_settings,
            num_repass: 1000,
            num_output: 100
        }
    } 

    pub fn run_query(self: &Self, query: &String) -> Vec<(u32, u32, f64)> {
        // First pass: fast, but inaccurate. Good for eliminating many poor candidates.
        let first_search = heuristic::run_query(&query, &self.heuristic_settings_feats);
        
        // Second pass: slow, but accurate. Good for refining a shortlist of candidates.
        let mut second_search: Vec<(u32, f64)> = Vec::new();
        for (setting_id, _) in &first_search[0..self.num_repass] {
            let score = nw::needleman_wunsch(&query, &self.tune_settings[setting_id].contour);
            second_search.push((*setting_id, score));
        }

        let mut sorted_rankings: Vec<_> = second_search.into_iter().collect();
        sorted_rankings.sort_by(|x,y| y.1.partial_cmp(&x.1).unwrap());    

        let mut results: Vec<(u32, u32, f64)> = Vec::new();

        for (setting_id, score) in sorted_rankings[0..self.num_output].iter() {
            let tune_id = self.tune_settings[setting_id].tune_id;
            results.push((tune_id, *setting_id, *score));
        }

        return results;
    }
}
