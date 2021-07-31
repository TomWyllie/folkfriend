mod nw;
mod heuristic;

use crate::folkfriend::index::structs::*;

// const NUM_REPASS: u32 = 1000;

pub fn run_query(query: &String, tune_settings: &TuneSettings) -> Vec<(u32, usize)> {
    let heuristic_search = heuristic::run_query(query, &tune_settings);

    // TODO re-pass with needleman wunsch
    // TODO something something lifetimes instead of copying with to_vec
    return heuristic_search;
    // return heuristic_search[0..1000].to_vec();
}