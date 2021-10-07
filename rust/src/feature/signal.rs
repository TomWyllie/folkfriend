use crate::ff_config;

pub fn validate_sample_rate(sample_rate: &u32) {
    if *sample_rate > ff_config::SAMPLE_RATE_MAX {
        panic!(
            "Sample rate must be not greater than {}",
            ff_config::SAMPLE_RATE_MAX
        );
    }
    if *sample_rate < ff_config::SAMPLE_RATE_MIN {
        panic!(
            "Sample rate must be not less than {}",
            ff_config::SAMPLE_RATE_MIN
        );
    }
}

pub fn hertz_to_midi(hertz: &f32) -> f32 {
    return 69. + 12. * (hertz / 440.).log2();
}