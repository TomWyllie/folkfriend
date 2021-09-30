use crate::folkfriend::feature::autocorrelate;
use crate::folkfriend::feature::signal::validate_sample_rate;
use crate::folkfriend::feature::types::{Features, Frame, InterpInds, Window};
use crate::folkfriend::feature::window::gen_blackman_window;
use crate::folkfriend::ff_config;
use rustfft::{algorithm::Radix4, FftDirection};
use std::convert::TryInto;

use crate::folkfriend::feature::interpolate::compute_interp_inds;

pub struct FeatureExtractor {
    pub sample_rate: u32,
    pub window_function: Window,
    pub fft: Radix4<f32>,
    pub interp_inds: InterpInds,
    pub features: Features,
}

impl FeatureExtractor {
    pub fn new(sample_rate: u32) -> FeatureExtractor {
        FeatureExtractor {
            sample_rate: sample_rate,
            window_function: gen_blackman_window(),
            fft: Radix4::new(ff_config::SPEC_WINDOW_SIZE, FftDirection::Forward),
            interp_inds: compute_interp_inds(&sample_rate),
            features: Vec::new(),
        }
    }

    pub fn set_sample_rate(&mut self, sample_rate: u32) {
        // Need to know the sample rate to undertake the linear resampling step
        validate_sample_rate(&sample_rate);
        self.interp_inds = compute_interp_inds(&sample_rate);
    }

    pub fn feed_wav(&mut self, signal: Vec<i16>) {
        let mut signal_f: Vec<f32> = vec![0.; signal.len()];

        for i in 0..signal.len() {
            signal_f[i] = (signal[i] as f32) / 32768.;
        }

        self.feed_signal(signal_f);
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
}
