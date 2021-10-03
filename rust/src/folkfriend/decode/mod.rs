mod beam_search;
mod contour;
mod pitch_model;
mod proposal;
mod tempo_model;
pub mod types;

use crate::folkfriend::feature::types::Features;
use crate::folkfriend::ff_config;
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

    pub fn decode(&self, features: &mut Features) -> Contour {
        let (lattice_path, _) = beam_search::decode(features, &self.pitch_model, &self.tempo_model);
        return contour::contour_from_lattice_path(&lattice_path);
    }
}
