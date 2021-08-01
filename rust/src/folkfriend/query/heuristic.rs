use std::collections::HashMap;
use std::collections::HashSet;

use crate::folkfriend::index::structs::*;

use std::time::Instant;

pub type SettingsFeats = HashMap<u32, HashSet<String>>;

pub fn build_settings_feats(tune_settings: &TuneSettings) -> SettingsFeats {
    let now = Instant::now();
    
    let mut settings_feats: SettingsFeats = HashMap::new();
    for (setting_id, setting) in tune_settings {
        let feats = trigrams(&setting.contour);
        settings_feats.insert(*setting_id, feats);
    }
    
    println!("Built heuristic index in {:.2?}", now.elapsed());
    
    return settings_feats;
}


pub fn run_query(query: &String, settings_feats: &SettingsFeats) -> Vec<(u32, usize)> {
    let query = trigrams(query);
    let mut ranked_settings: HashMap<u32, usize> = HashMap::new();
    
    for (setting_id, feats) in settings_feats {
        let intersection = query.intersection(feats);
        let score = intersection.collect::<Vec<&String>>().len();
        ranked_settings.insert(*setting_id, score);
    }
    
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