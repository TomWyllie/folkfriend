use crate::ff_config;
use std::fmt;

pub fn validate_sample_rate(sample_rate: &u32) -> bool {
    return *sample_rate < ff_config::SAMPLE_RATE_MAX && *sample_rate > ff_config::SAMPLE_RATE_MIN;
}

pub fn hertz_to_midi(hertz: &f32) -> f32 {
    return 69. + 12. * (hertz / 440.).log2();
}

#[derive(Debug, Clone)]
pub struct SampleRateError;

impl fmt::Display for SampleRateError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "Invalid sample rate")
    }
}
