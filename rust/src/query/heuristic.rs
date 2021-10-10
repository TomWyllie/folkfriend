use fnv::FnvHashSet as HashSet;
use std::collections::HashMap;

use crate::index::schema::*;

use std::convert::TryInto;

pub type HeuristicFeatures = HashSet<[char; 3]>;
pub type SettingsFeats = HashMap<SettingID, HeuristicFeatures>;
pub type AliasFeats = HashMap<TuneID, Vec<HeuristicFeatures>>;

#[derive(Debug)]
pub struct ScoredName {
    pub tune_id: TuneID,
    pub alias_index: usize,
    pub ngram_score: usize,
}

pub fn build_settings_feats(tune_settings: &TuneSettings) -> SettingsFeats {
    let mut settings_feats: SettingsFeats = HashMap::new();
    for (setting_id, setting) in tune_settings {
        let feats = trigrams(&setting.contour);
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
            feats_by_name.push(trigrams(&tune_name));
        }

        aliases_feats.insert(tune_id.clone(), feats_by_name);
    }
    return aliases_feats;
}

pub fn run_transcription_query(
    query: &String,
    settings_feats: &SettingsFeats,
) -> Vec<(SettingID, usize)> {
    let query = trigrams(query);
    let mut ranked_settings: HashMap<SettingID, usize> = HashMap::new();
    for (setting_id, feats) in settings_feats {
        let intersection = query.intersection(feats);
        let score = intersection.collect::<Vec<&[char; 3]>>().len();
        ranked_settings.insert(setting_id.clone(), score);
    }
    let mut sorted_rankings: Vec<_> = ranked_settings.into_iter().collect();
    sorted_rankings.sort_by(|x, y| y.1.cmp(&x.1));

    return sorted_rankings;
}

pub fn run_name_query<'a>(query: &String, alias_feats: &AliasFeats) -> Vec<ScoredName> {
    let query = query.to_lowercase();
    let query = trigrams(&query);

    let mut scored_names: Vec<ScoredName> = Vec::new();
    for (tune_id, feats) in alias_feats {
        for (i, feat) in feats.iter().enumerate() {
            let intersection = query.intersection(feat);
            let score = intersection.collect::<Vec<&[char; 3]>>().len();
            scored_names.push(ScoredName {
                tune_id: tune_id.clone(),
                alias_index: i,
                ngram_score: score,
            });
        }
    }

    return scored_names;
}

pub fn trigrams(query: &String) -> HeuristicFeatures {
    let mut feats: HeuristicFeatures = HashSet::default();
    let chars: Vec<char> = query.chars().collect();

    if chars.len() <= 2 {
        return feats;
    }

    for i in 0..chars.len() - 2 {
        let ngram: [char; 3] = chars[i..i + 3].try_into().unwrap();
        feats.insert(ngram);
    }

    return feats;
}
