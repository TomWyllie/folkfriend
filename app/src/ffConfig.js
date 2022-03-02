// These parameters are all just copied from ff_config.rs, which provides a
//  detailed explanation as to the meaning of these values. It's simply 
//  convenient for the frontend to be able to easily access some of these
//  global constants.
const ffConfig = {
    // eslint-disable-next-line no-undef
    FRONTEND_VERSION: process.env.PACKAGE_VERSION,
    RECORDING_TIME_LIMIT_MS: 10000,
    SAMPLE_RATE_DEFAULT: 48000,
    SAMPLE_RATE_MIN: 3952,
    SAMPLE_RATE_MAX: 66974,
    SPEC_WINDOW_SIZE: 1024,
};

export default ffConfig;