mod beam_search;
mod contour;
mod pitch_model;
pub mod types;

use crate::feature::types::Features;
use std::fmt;
use types::{Contour, ContourString, LatticePath};

pub struct FeatureDecoder {
    // pitch_model: pitch_model::PitchModel,
// tempo_model: tempo_model::TempoModel,
}

#[derive(Debug, Clone)]
pub struct DecoderError;

impl fmt::Display for DecoderError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "Error decoding features")
    }
}

impl FeatureDecoder {
    pub fn new() -> FeatureDecoder {
        FeatureDecoder {
            // pitch_model: pitch_model::PitchModel::new(),
            // tempo_model: tempo_model::TempoModel::new(ff_config::TEMP_TEMPO_PARAM),
        }
    }

    pub fn decode_lattice_path(
        &self,
        features: &mut Features,
    ) -> Result<LatticePath, DecoderError> {
        // beam_search::decode(features, &self.pitch_model, &self.tempo_model)
        beam_search::decode(features)
    }

    pub fn decode_contour(
        &self,
        lattice_path: &LatticePath,
    ) -> Result<ContourString, DecoderError> {
        let contour: Contour = contour::contour_from_lattice_path(lattice_path)?;
        return Ok(types::contour_to_contour_string(&contour));
    }
}
