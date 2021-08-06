use crate::folkfriend::ff_config;
use crate::folkfriend::sig_proc::window as window_function;
use rustfft::{algorithm::Radix4, num_complex::Complex, Fft, FftDirection};
use std::convert::TryInto;

type InterpInds = Vec<(usize, usize, f32)>;

pub struct FeatureExtractor {
    pub sample_rate: u32,
    pub window_function: [f32; ff_config::SPEC_WINDOW_SIZE],
    pub fft: Radix4<f32>,
    pub interp_inds: InterpInds,
    pub features: Vec<Vec<u16>>, // TODO datatype?
}

impl FeatureExtractor {
    pub fn new(sample_rate: u32) -> FeatureExtractor {
        FeatureExtractor {
            sample_rate: sample_rate,
            window_function: window_function::gen_blackman_window(),
            fft: Radix4::new(ff_config::SPEC_WINDOW_SIZE, FftDirection::Forward),
            interp_inds: compute_interp_inds(&sample_rate),
            features: Vec::new(),
        }
    }

    pub fn set_sample_rate(&self, sample_rate: u32) {
        // Need to know the sample rate to undertake the linear resampling step
        validate_sample_rate(&sample_rate);

        // Generate tuples of (autocorrelation_bin, feature_bin, weight)
    }

    pub fn feed_signal(&self, signal: Vec<f32>) {
        // Implicit floor division
        let num_winds = signal.len() / ff_config::SPEC_WINDOW_SIZE;
        let last_ind = num_winds * ff_config::SPEC_WINDOW_SIZE;
        for i in (0..last_ind).step_by(ff_config::SPEC_WINDOW_SIZE) {
            self.feed_window(
                signal[i..i + ff_config::SPEC_WINDOW_SIZE]
                    .try_into()
                    .expect("Invalid window length"),
            );
        }
    }
    pub fn feed_window(&self, window: [f32; ff_config::SPEC_WINDOW_SIZE]) {
        let mut buffer: [Complex<f32>; ff_config::SPEC_WINDOW_SIZE] =
            [Complex { re: 0.0, im: 0.0 }; ff_config::SPEC_WINDOW_SIZE];
        for i in 0..buffer.len() {
            // buffer[i].re = window[i] * &self.window_function[i];
            buffer[i].re = 1.0 * &self.window_function[i];
        }

        // Fourier transform of windowed signal, X(w)
        self.fft.process(&mut buffer);

        // First, compute power spectrum, which is exactly X(w)X*(w), which is
        //  the same as |X|^2. Then, take the sextic root of the power spectrum
        //  (which is the same as directly computing cube root |X|). This step
        //  corresponds to a "k-value" of 1/3, see
        //  https://labrosa.ee.columbia.edu/~dpwe/papers/ToloK2000-mupitch.pdf
        //  (which recommends k as 2/3) for this magnitude compression.
        for i in 0..buffer.len() {
            // This line is ~1.75 faster than using norm()
            // buffer[i].re = buffer[i].norm().cbrt();
            buffer[i].re = (buffer[i].re.powf(2.) + buffer[i].im.powf(2.)).powf(1. / 6.);
            buffer[i].im = 0.;
        }
        // Fourier transform of magnitude-compressed power spectrum.
        //  Note! Fourier transform is basically the same as inverse
        //  fourier transform (we have real and even functions here).
        //  We can reuse the exact same FFT object.
        //  See Tom's old 3G3 jotter for some calculations on this.
        self.fft.process(&mut buffer);

        // Peak pruning. At this point buffer[i].im = 0 for all i.
        for i in 0..buffer.len() {
            // TODO is the compiler smart enough that the if branch isn't
            //  inefficient here? Or is max(0, x) much better?
            if buffer[i].re.signum() == -1. {
                buffer[i].re = 0.;
            }
            println!("{:?}", buffer[i].re);
        }

        // TODO now do linear resampling
        // TODO then Octave fixing
        // TODO then noise cleaning

        panic!("end");
    }
}

fn validate_sample_rate(sample_rate: &u32) {
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

fn compute_interp_inds(sample_rate: &u32) -> InterpInds {
    validate_sample_rate(sample_rate);
    let mut interp_inds: InterpInds = Vec::new();
    let half_window: usize = ff_config::SPEC_WINDOW_SIZE / 2;

    // We will have a buffer that contains 1 + SPEC_WINDOW_SIZE / 2 unique
    //  frequencies, which are sample_rate / n where n goes from 0 to
    //  SPEC_WINDOW_SIZE / 2. The values correspond to autocorrelation
    //  indices [0, 1, ..., N-1, -N, -N+1, -N+2, ..., -2, -1].
    //                     |_______|
    //               Note what happens here
    //
    // i.e. index 0 is the DC bin, leaving an odd number of elements remaining
    //  which are symmetric about bin 512, i.e.
    //  bins (1:511) inclusive = reverse(513:1023) inclusive.
    // That's 511 values, plus DC and plus bin 512 gives 513 unique values.



    // KISS!!

    // Python implementation
    // lo_indices = []
    // lo_weights = []
    // hi_indices = []
    // hi_weights = []

    // for i in range(lmb):
    //     # Each linear midi bin is a linear combination of two bins from
    //     #  the spectrogram
    //     linear_bin_midi_value = ff_config.LINEAR_MIDI_BINS_[i]

    //     if linear_bin_midi_value < non_linear_bins[len(non_linear_bins) - 2]:
    //         raise RuntimeError("Linear bin goes too low")

    //     # Note both arrays are monotonically decreasing in value
    //     lo = 0
    //     for j in range(len(non_linear_bins)):
    //         if linear_bin_midi_value > non_linear_bins[j]:
    //             lo = j
    //             break

    //     delta = non_linear_bins[lo - 1] - non_linear_bins[lo]
    //     x1 = (non_linear_bins[lo - 1] - linear_bin_midi_value) / delta
    //     x2 = -(non_linear_bins[lo] - linear_bin_midi_value) / delta

    //     if x1 > 1 or x1 < 0 or x2 > 1 or x2 < 0:
    //         raise RuntimeError(f'Invalid x1: {x1}, x2: {x2}')

    //     # Frequencies are decreasing so lower index => higher freq
    //     lo_indices.append(lo)
    //     lo_weights.append(x1)
    //     hi_indices.append(lo - 1)
    //     hi_weights.append(x2)











    let mut midi_bins: Vec<f32> = Vec::new();

    for ac_bin in 1..half_window+1 {
        let ac_freq = *sample_rate as f32 / ac_bin as f32;
        let ac_midi = hertz_to_midi(&ac_freq);
        midi_bins.push(ac_midi);
    }

    for i in 1..midi_bins.len() {
        // Four cases possible
        
        // Case 1: This pitch, and all those above it, are too high to be of
        //  interest. Keep iterating until we reach a relevant pitch.
        if midi_bins[i] > ff_config::MIDI_HIGH as f32 {
            continue;
        }

        // Case 2: The frequency of a desired MIDI value lies between this bin
        //  and the previous (higher pitched) one. Linearly interpolate.
    }

    // Low feature index = low MIDI note (= low frequency)

    return vec![(0, 0, 0f32)];
}

fn hertz_to_midi(hertz: &f32) -> f32 {
    return 69. + 12. * (hertz / 440.).log2();
}