use fnv::FnvHashSet as HashSet;
use std::collections::HashMap;

use crate::index::schema::*;

use std::convert::TryInto;

pub type HeuristicFeatures = HashSet<[char; 4]>;
pub type SettingsFeats = HashMap<SettingID, HeuristicFeatures>;
pub type AliasFeats = HashMap<TuneID, Vec<HeuristicFeatures>>;

// use std::time::Instant;

#[derive(Debug)]
pub struct ScoredName {
    pub tune_id: TuneID,
    pub alias_index: usize,
    pub ngram_score: usize,
}

pub fn build_settings_feats(tune_settings: &TuneSettings) -> SettingsFeats {
    let mut settings_feats: SettingsFeats = HashMap::new();
    for (setting_id, setting) in tune_settings {
        let feats = trigrams(&setting.contour, 2);
        settings_feats.insert(setting_id.clone(), feats);
    }
    return settings_feats;
}

pub fn build_aliases_feats(tune_aliases: &TuneAliases) -> AliasFeats {
    let mut aliases_feats: AliasFeats = HashMap::new();

    // tune_id is not, in general, the same as setting_id
    for (tune_id, tune_names) in tune_aliases {
        let mut feats_by_name: Vec<HeuristicFeatures> = Vec::new();
        for tune_name in tune_names {
            feats_by_name.push(trigrams(&tune_name, 1));
        }

        aliases_feats.insert(tune_id.clone(), feats_by_name);
    }
    return aliases_feats;
}

pub fn run_transcription_query(
    query: &String,
    settings_feats: &SettingsFeats,
) -> Vec<(SettingID, usize)> {
    let query = trigrams(query, 1);
    let mut ranked_settings: HashMap<SettingID, usize> = HashMap::new();
    // let now = Instant::now();

    for (setting_id, feats) in settings_feats {
        let intersection = query.intersection(feats);
        let score = intersection.collect::<Vec<&[char; 4]>>().len();
        ranked_settings.insert(setting_id.clone(), score);
    }
    let mut sorted_rankings: Vec<_> = ranked_settings.into_iter().collect();
    sorted_rankings.sort_by(|x, y| y.1.cmp(&x.1));

    // eprintln!("Heuristic transcription query in {:.2?}", now.elapsed());

    return sorted_rankings;
}

pub fn run_name_query<'a>(query: &String, alias_feats: &AliasFeats) -> Vec<ScoredName> {
    let query = query.to_lowercase();
    let query = trigrams(&query, 1);

    let mut scored_names: Vec<ScoredName> = Vec::new();
    for (tune_id, feats) in alias_feats {
        for (i, feat) in feats.iter().enumerate() {
            let intersection = query.intersection(feat);
            let score = intersection.collect::<Vec<&[char; 4]>>().len();
            scored_names.push(ScoredName {
                tune_id: tune_id.clone(),
                alias_index: i,
                ngram_score: score,
            });
        }
    }

    return scored_names;
}

pub fn trigrams(query: &String, step: usize) -> HeuristicFeatures {
    let mut feats: HeuristicFeatures = HashSet::default();
    let chars: Vec<char> = query.chars().collect();
    
    if chars.len() <= 3 {
        return feats;
    }

    for i in (0..chars.len() - 3).step_by(step) {
        let ngram: [char; 4] = chars[i..i + 4].try_into().unwrap();
        feats.insert(ngram);
    }
    return feats;
}
