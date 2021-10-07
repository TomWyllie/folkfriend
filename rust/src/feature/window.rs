use crate::ff_config;
use std::f32::consts::PI;

// Code based on https://docs.rs/dsp/0.8.1/src/dsp/window.rs.html#217-231
// Just need one simple Blackman window function.
pub fn gen_blackman_window() -> [f32; ff_config::SPEC_WINDOW_SIZE] {
    let a0 = 7938.0 / 18608.0;
    let a1 = 9240.0 / 18608.0;
    let a2 = 1430.0 / 18608.0;
    let mut samples = [0.0; ff_config::SPEC_WINDOW_SIZE];
    let size = (ff_config::SPEC_WINDOW_SIZE - 1) as f32;
    for i in 0..ff_config::SPEC_WINDOW_SIZE {
        let n = i as f32;
        let v = a0 - a1 * (2.0 * PI * n / size).cos() + a2 * (4.0 * PI * n / size).cos();
        samples[i] = v;
    }
    return samples;
}