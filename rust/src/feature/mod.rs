pub mod autocorrelate;
pub mod interpolate;
pub mod normalise;
pub mod signal;
pub mod types;
pub mod window;

use crate::ff_config;
use interpolate::compute_interp_inds;
use rustfft::{algorithm::Radix4, FftDirection};
use signal::validate_sample_rate;
use std::convert::TryInto;
use types::{Features, Frame, InterpInds, Window};
use window::gen_blackman_window;

pub struct FeatureExtractor {
    pub sample_rate: u32,
    pub window_function: Window,
    pub fft: Radix4<f32>,
    pub interp_inds: InterpInds,
    pub features: Features,
}

impl FeatureExtractor {
    pub fn new(sample_rate: u32) -> Result<FeatureExtractor, signal::SampleRateError> {
        if !validate_sample_rate(&sample_rate) {
            return Err(signal::SampleRateError);
        }

        Ok(FeatureExtractor {
            sample_rate: sample_rate,
            window_function: gen_blackman_window(),
            fft: Radix4::new(ff_config::SPEC_WINDOW_SIZE, FftDirection::Forward),
            interp_inds: compute_interp_inds(&sample_rate),
            features: Vec::new(),
        })
    }

    pub fn set_sample_rate(&mut self, sample_rate: u32) {
        // Need to know the sample rate to undertake the linear resampling step
        validate_sample_rate(&sample_rate);
        self.interp_inds = compute_interp_inds(&sample_rate);
    }

    pub fn feed_signal(&mut self, signal: Vec<f32>) {
        // Implicit floor division
        let num_windows = signal.len() / ff_config::SPEC_WINDOW_SIZE;
        let last_ind = num_windows * ff_config::SPEC_WINDOW_SIZE;
        for i in (0..last_ind).step_by(ff_config::SPEC_WINDOW_SIZE) {
            self.feed_window(
                signal[i..i + ff_config::SPEC_WINDOW_SIZE]
                    .try_into()
                    .expect("Invalid window length"),
            );
        }
    }
    pub fn feed_window(&mut self, window: [f32; ff_config::SPEC_WINDOW_SIZE]) {
        let frame: Frame = autocorrelate::modified_autocorrelation(
            window,
            &self.window_function,
            &self.fft,
            &self.interp_inds,
        );
        self.features.push(frame);
    }

    pub fn flush(&mut self) {
        self.features = Vec::new();
    }
}
