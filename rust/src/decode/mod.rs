mod beam_search;
mod contour;
mod pitch_model;
pub mod types;

use crate::feature::types::Features;
use crate::feature::signal;
use std::fmt;
use types::{Contour, ContourString, LatticePath};

pub struct FeatureDecoder {
    pub sample_rate: u32
}

#[derive(Debug, Clone)]
pub struct DecoderError;

impl fmt::Display for DecoderError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "Error decoding features")
    }
}

impl FeatureDecoder {
    pub fn new(sample_rate: u32) -> Result<FeatureDecoder, signal::SampleRateError> {
        if !signal::validate_sample_rate(&sample_rate) {
            return Err(signal::SampleRateError);
        }
        
        Ok(FeatureDecoder {
            sample_rate: sample_rate
        })
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
        features: &Features
    ) -> Result<ContourString, DecoderError> {
        let contour: Contour = contour::contour_from_lattice_path(lattice_path, features, self.sample_rate)?;
        return Ok(types::contour_to_contour_string(&contour));
    }
}
