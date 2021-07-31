use std::collections::HashMap;
use std::collections::HashSet;

use crate::folkfriend::index::structs::*;

use std::time::Instant;

pub fn run_query(query: &String, tune_settings: &TuneSettings) -> Vec<(u32, usize)> {
    let query = trigrams(query);
    let mut ranked_settings: HashMap<u32, usize> = HashMap::new();
    
    let now = Instant::now();
    
    let mut settings_feats: HashMap<u32, HashSet<String>> = HashMap::new();
    
    for (setting_id, setting) in tune_settings {
        let feats = trigrams(&setting.contour);
        settings_feats.insert(*setting_id, feats);
    }
    
    // let elapsed = now.elapsed();
    // println!("Elapsed: {:.2?}", elapsed);
    let now = Instant::now();

    for (setting_id, _) in tune_settings {
        let intersection = query.intersection(&settings_feats[setting_id]);
        let score = intersection.collect::<Vec<&String>>().len();
        ranked_settings.insert(*setting_id, score);
    }
    
    let elapsed = now.elapsed();
    println!("Elapsed: {:.2?}", elapsed);

    let mut sorted_rankings: Vec<_> = ranked_settings.into_iter().collect();
    sorted_rankings.sort_by(|x,y| y.1.cmp(&x.1));


    return sorted_rankings;
}

pub fn trigrams(query: &String) -> HashSet<String> {
    let mut feats: HashSet<String> = HashSet::new();

    if &query.len() <= &2 {
        return feats;
    }
    
    for i in 0..&query.len()-2 {
        let ngram: String = query[i..i+3].to_string();
        feats.insert(ngram);
    }
    return feats;
}

// fn main() {
//     println!("{:#?}", trigrams("hello world, hello"));
// }