use std::collections::HashMap;
use fnv::FnvHashSet as HashSet;

use crate::folkfriend::index::schema::*;
use crate::folkfriend::index::TuneIndex;
use crate::folkfriend::query;

use std::convert::TryInto;
use std::time::Instant;

pub type HeuristicFeatures = HashSet<[char; 3]>;
pub type SettingsFeats = HashMap<u32, HeuristicFeatures>;
pub type AliasFeats = HashMap<u32, Vec<HeuristicFeatures>>;

pub fn build_settings_feats(tune_settings: &TuneSettings) -> SettingsFeats {
    let now = Instant::now();
    
    let mut settings_feats: SettingsFeats = HashMap::new();
    for (setting_id, setting) in tune_settings {
        let feats = trigrams(&setting.contour);
        settings_feats.insert(*setting_id, feats);
    }
    
    eprintln!("Built heuristic setting index in {:.2?}", now.elapsed());
    
    return settings_feats;
}

pub fn build_aliases_feats(tune_aliases: &TuneAliases) -> AliasFeats {
    let now = Instant::now();
    
    let mut aliases_feats: AliasFeats = HashMap::new();

    // tune_id is not, in general, the same as setting_id
    for (tune_id, tune_names) in tune_aliases {
        let mut feats_by_name: Vec<HeuristicFeatures> = Vec::new(); 
        
        for tune_name in tune_names {
            feats_by_name.push(trigrams(&tune_name));
        }

        aliases_feats.insert(*tune_id, feats_by_name);
    }
    
    eprintln!("Built heuristic aliases index in {:.2?}", now.elapsed());
    
    return aliases_feats;
}

pub fn run_transcription_query(query: &String, settings_feats: &SettingsFeats) -> Vec<(u32, usize)> {
    let query = trigrams(query);
    let mut ranked_settings: HashMap<u32, usize> = HashMap::new();
    
    for (setting_id, feats) in settings_feats {
        let intersection = query.intersection(feats);
        let score = intersection.collect::<Vec<&[char; 3]>>().len();
        ranked_settings.insert(*setting_id, score);
    }
    
    let mut sorted_rankings: Vec<_> = ranked_settings.into_iter().collect();
    sorted_rankings.sort_by(|x,y| y.1.cmp(&x.1));

    return sorted_rankings;
}

pub fn run_name_query<'a>(query: &String, tune_index: &'a TuneIndex, alias_feats: &AliasFeats) -> query::NameQueryResults<'a> {
    let query = query.to_lowercase();
    let query = trigrams(&query);

    #[derive(Debug)]
    struct ScoredName {
        tune_id: u32,
        alias_index: usize,
        ngram_score: usize
    }

    let mut scored_names: Vec<ScoredName> = Vec::new();
    
    for (tune_id, feats) in alias_feats {
        for (i, feat) in feats.iter().enumerate() {
            let intersection = query.intersection(feat);
            let score = intersection.collect::<Vec<&[char; 3]>>().len();
            scored_names.push(ScoredName {
                tune_id: *tune_id,
                alias_index: i,
                ngram_score: score
            });
        }
    }
    
    scored_names
    .sort_unstable_by(|a, b| {
        match b.ngram_score.cmp(&a.ngram_score) {
            std::cmp::Ordering::Less => std::cmp::Ordering::Less,
            std::cmp::Ordering::Greater => std::cmp::Ordering::Greater,
            std::cmp::Ordering::Equal => {
                let a_alias_len = &tune_index.aliases.get(&a.tune_id).unwrap()[a.alias_index].len();
                let b_alias_len = &tune_index.aliases.get(&b.tune_id).unwrap()[b.alias_index].len();
                return a_alias_len.cmp(&b_alias_len)
            }
        }
    });
    
    let top_scores: query::NameQueryResults = scored_names
    .iter()
    // TODO de-deuplicate by tune IDs at this point
    // TODO also configure this better somewhere...
    .take(20)
    .map(|t| {
        query::NameQueryRecord {
            // TODO get the setting ID of the first copy of THIS tune
            setting: &tune_index.settings.get(&1).unwrap(),
            display_name: &tune_index.aliases.get(&t.tune_id).unwrap()[t.alias_index]
        }
    })
    .collect();

    return top_scores;
}


pub fn trigrams(query: &String) -> HeuristicFeatures {
    let mut feats: HeuristicFeatures = HashSet::default();
    
    let chars: Vec<char> = query.chars().collect();

    if chars.len() <= 2 {
        return feats;
    }
    
    for i in 0..chars.len()-2 {
        let ngram: [char; 3] = chars[i..i+3].try_into().unwrap();
        feats.insert(ngram);
    }
    return feats;
}
