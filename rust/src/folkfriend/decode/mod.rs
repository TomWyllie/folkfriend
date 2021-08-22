mod beam_search;
mod pitch_model;
mod proposal;
mod tempo_model;
mod types;

use crate::folkfriend::ff_config;
use crate::folkfriend::feature::types::Features;
use types::Contour;

pub struct FeatureDecoder {
    pitch_model: pitch_model::PitchModel,
    tempo_model: tempo_model::TempoModel,
}

impl FeatureDecoder {
    pub fn new() -> FeatureDecoder {
        FeatureDecoder {
            pitch_model: pitch_model::PitchModel::new(),
            tempo_model: tempo_model::TempoModel::new(ff_config::TEMP_TEMPO_PARAM),
        }
    }

    pub fn decode(&self, features: Features) -> Contour {
        let (contour, _) = beam_search::decode(features, &self.pitch_model, &self.tempo_model);
        return contour;
    }
}