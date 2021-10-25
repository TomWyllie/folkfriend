use crate::ff_config;
use crate::index::schema::*;
use crate::index::TuneIndex;
use aho_corasick::{AhoCorasick, Match};
use std::collections::HashMap;

pub struct ScoredName {
    pub tune_id: TuneID,
    pub alias_index: usize,
    pub ngram_score: usize,
}

pub fn run_transcription_query(
    query: &String,
    // settings_feats: &SettingsFeats,
    tune_index: &TuneIndex,
) -> Vec<(SettingID, usize)> {
    // let query = trigrams_fast(query);
    let ngrams = ngrams_str(query, ff_config::QUERY_NGRAM_SIZE_CONTOUR);
    let mut ranked_settings: HashMap<SettingID, usize> = HashMap::new();
    let ac = AhoCorasick::new_auto_configured(&ngrams);
    for (setting_id, setting) in &tune_index.settings {
        let score = ac
            .find_overlapping_iter(&setting.contour)
            .collect::<Vec<Match>>()
            .len();
        ranked_settings.insert(setting_id.to_string(), score);
    }

    let mut sorted_rankings: Vec<_> = ranked_settings.into_iter().collect();
    sorted_rankings.sort_by(|x, y| y.1.cmp(&x.1));
    return sorted_rankings;
}

pub fn run_name_query(query: &String, tune_index: &TuneIndex) -> Vec<ScoredName> {
    let query = query.to_lowercase();
    let ngrams = ngrams_str(&query, ff_config::QUERY_NGRAM_SIZE_NAME);

    let mut scored_names: Vec<ScoredName> = Vec::new();
    let ac = AhoCorasick::new_auto_configured(&ngrams);
    for (tune_id, aliases) in &tune_index.aliases {
        for (alias_id, alias) in aliases.iter().enumerate() {
            let score = ac
                .find_overlapping_iter(&alias)
                .collect::<Vec<Match>>()
                .len();
            // let score = score as f32 / alias.len() as f32;
            scored_names.push(ScoredName {
                tune_id: tune_id.clone(),
                alias_index: alias_id,
                ngram_score: score,
            });
        }
    }

    return scored_names;
}

pub fn ngrams_str(query: &String, n: usize) -> Vec<String> {
    // n=2 -> 'bigram'
    // n=3 -> 'trigram'
    //  etc...
    let mut grams: Vec<String> = Vec::new();
    let chars: Vec<char> = query.chars().collect();
    if chars.len() < n {
        grams.push(chars.iter().collect());
        return grams;
    }

    for i in 0..chars.len() - (n - 1) {
        let ngram: String = chars[i..i + n].iter().collect();
        grams.push(ngram);
    }
    return grams;
}
