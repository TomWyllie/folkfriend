use crate::folkfriend::ff_config;
use crate::folkfriend::sig_proc::window as window_function;
use rustfft::{Fft, FftDirection, algorithm::Radix4, num_complex::Complex};
use std::convert::TryInto;

pub struct FeatureExtractor {
    pub features: Vec<Vec<u16>>, // TODO datatype?
    pub fft: Radix4<f32>,
    pub window_function: [f32; ff_config::SPEC_WINDOW_SIZE]
}

impl FeatureExtractor {
    pub fn new() -> FeatureExtractor {
        FeatureExtractor {
            features: Vec::new(),
            fft: Radix4::new(ff_config::SPEC_WINDOW_SIZE, FftDirection::Forward),
            window_function: window_function::gen_blackman_window()
        }
    }

    pub fn feed_signal(&self, signal: Vec<f32>) {
        // Implicit floor division
        let num_winds = signal.len() / ff_config::SPEC_WINDOW_SIZE;
        let last_ind = num_winds * ff_config::SPEC_WINDOW_SIZE;
        for i in (0..last_ind).step_by(ff_config::SPEC_WINDOW_SIZE) {
            self.feed_window(signal[i..i+ff_config::SPEC_WINDOW_SIZE].try_into().expect("Invalid window length"));
        }
    }
    
    // [Complex<f32>; ff_config::SPEC_WINDOW_SIZE]

    pub fn feed_window(&self, window: [f32; ff_config::SPEC_WINDOW_SIZE]) {
        let mut buffer: [Complex<f32>; ff_config::SPEC_WINDOW_SIZE] = [Complex{ re: 0.0, im: 0.0 }; ff_config::SPEC_WINDOW_SIZE];
        for i in 0..buffer.len() {
            buffer[i].re = window[i] * &self.window_function[i];
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
            buffer[i].re = (buffer[i].re.powf(2.) + buffer[i].im.powf(2.)).powf(1./6.);
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
        }

        // TODO now do linear resampling
        // TODO then Octave fixing
        // TODO then noise cleaning
    }
}