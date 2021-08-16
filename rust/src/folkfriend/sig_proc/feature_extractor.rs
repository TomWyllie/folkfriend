use crate::folkfriend::ff_config;
use crate::folkfriend::sig_proc::spectrogram;
use crate::folkfriend::sig_proc::window as window_function;
use rustfft::{algorithm::Radix4, num_complex::Complex, Fft, FftDirection};
use std::convert::TryInto;

pub type InterpInds = Vec<InterpInd>;

#[derive(Debug)]
pub struct InterpInd {
    lo_weight: f32,
    hi_weight: f32,
    hi_index: usize,
}

pub struct FeatureExtractor {
    pub sample_rate: u32,
    pub window_function: [f32; ff_config::SPEC_WINDOW_SIZE],
    pub fft: Radix4<f32>,
    pub interp_inds: InterpInds,
    pub features: spectrogram::Features,
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

    pub fn set_sample_rate(&mut self, sample_rate: u32) {
        // Need to know the sample rate to undertake the linear resampling step
        validate_sample_rate(&sample_rate);
        self.interp_inds = compute_interp_inds(&sample_rate);
    }

    pub fn feed_signal(&mut self, signal: Vec<f32>) {
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
    pub fn feed_window(&mut self, window: [f32; ff_config::SPEC_WINDOW_SIZE]) {
        // Define empty buffer for use with this frame
        let mut buffer: [Complex<f32>; ff_config::SPEC_WINDOW_SIZE] =
            [Complex { re: 0.0, im: 0.0 }; ff_config::SPEC_WINDOW_SIZE];
        // =============================
        // === Apply window function ===
        // =============================

        for i in 0..buffer.len() {
            buffer[i].re = window[i] * &self.window_function[i];
        }

        // ===============================
        // === Compute autocorrelation ===
        // ===============================

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

        // =============================================
        // === Compute features from autocorrelation ===
        // =============================================

        // Peak pruning. At this point buffer[i].im = 0 for all i.
        for i in 0..buffer.len() {
            // TODO is the compiler smart enough that the if branch isn't
            //  inefficient here? Or is max(0, x) much better?
            if buffer[i].re.signum() == -1. {
                buffer[i].re = 0.;
            }
        }

        // We have now spectral energy at the frequencies described above.
        //  Use linear interpolation to find the energy at the frequencies of
        //  each of the MIDI notes in the range of MIDI values that folkfriend
        //  uses.
        let mut features: spectrogram::Frame = [0.; ff_config::MIDI_NUM as usize];
        for i in 0..ff_config::SPEC_BINS_NUM as usize {
            // Perform linear interpolation
            let hi_wt = self.interp_inds[i].hi_weight;
            let lo_wt = self.interp_inds[i].lo_weight;
            let hi_ac = buffer[self.interp_inds[i].hi_index].re;
            let lo_ac = buffer[self.interp_inds[i].hi_index - 1].re;
            let feature = hi_wt * hi_ac + lo_wt * lo_ac;
            features[i / ff_config::SPEC_BINS_PER_MIDI as usize] += feature;
        }

        // ==========================================
        // === Postfiltering of computed features ===
        // ==========================================

        // Octave fixing

        // This next little algorithm is a bit funny. It's not as complicated
        //  as it sounds. Any note 12 MIDI notes (1 octave) higher than another
        //  is likely to represent a timbre containing harmonics. We don't want
        //  to individually track each harmonic, rather extract the single
        //  fundemental frequency. In this algorithm, if a note N1 is an octave
        //  lower than a note N2, and E1 < E2, where E is the energy of a note,
        //  then "shift" the lower harmonic up an octave by setting
        //  E2 += E1, E1 = 0. If E1 > E2, do nothing.
        //  If we have the same situation spanning two octaves, with notes N1,
        //  N2, N3, and E1 < E2 < E3 then shift the energy up to E3, i.e. set
        //  E3 = E2 + E1, E1 = 0, E2 = 0. However, if E2 < E1 < E3 then shift
        //  E2 to E3 but leave E1 unchanged. This generalises naturally to an
        //  arbitrary number of octaves.

        //  This algorithm preserves the total energy of the spectrogram, and
        //  only ever shifts energy around by moving it by whole octaves.

        // Low indices = low frequencies.
        for musical_key in 0..12 {
            let mut ind = musical_key;
            let mut inds: Vec<usize> = Vec::new();
            let mut should_shift: Vec<bool> = Vec::new();

            while ind < features.len() - 12 {
                should_shift.push(features[ind + 12] > features[ind]);
                inds.push(ind);
                ind += 12;
            }

            for (i, do_shift) in should_shift.iter().enumerate() {
                // basically if true, move up an octave and set to zero
                // if not true, continue
                if *do_shift {
                    features[inds[i] + 12] += features[inds[i]];
                    features[inds[i]] = 0.;
                }
            }
        }

        // Noise filtering

        // Simple algorithm here - retain only the 5 most energetic features
        //  each frame. This significantly speeds up the later decoder step.

        // Tom is not very good at Rust. There's probably some things to be
        //  improved here.

        let mut enum_features: Vec<_> = features.iter().enumerate().collect::<Vec<_>>();
        enum_features.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());

        let feature_indices: Vec<usize> = enum_features.iter().map(|a| a.0).collect();

        for i in &feature_indices
            [0..(ff_config::MIDI_NUM as usize - ff_config::RETAINED_FEATURES_PER_FRAME as usize)]
        {
            features[*i] = 0.;
        }

        self.features.push(features);
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

    let mut ac_bin_midis: Vec<f32> = Vec::new();

    for ac_bin in 1..half_window + 1 {
        let ac_freq = *sample_rate as f32 / ac_bin as f32;
        let ac_midi = hertz_to_midi(&ac_freq);
        ac_bin_midis.push(ac_midi);
    }
    // 0th bin is highest
    if ac_bin_midis[0] < ff_config::MIDI_HIGH as f32
        || ac_bin_midis[half_window - 1] > ff_config::MIDI_LOW as f32
    {
        panic!("Spectrogram range is insufficient");
    }

    let mut interp_indices: InterpInds = Vec::new();

    // Compute lowest MIDI value.
    //  e.g. if lowest MIDI note is 48 and SPEC_BINS_PER_MIDI is 3 then the
    //  MIDI values we calculate are [47.666, 48.0, 48.333, ..., ].
    //  These calculated MIDI values are then binned into one feature per note.
    let edge =
        (ff_config::SPEC_BINS_PER_MIDI as f32 / 2.).floor() / ff_config::SPEC_BINS_PER_MIDI as f32;
    let lo_midi = ff_config::MIDI_LOW as f32 - edge;
    let spec_bin_width = 1. / ff_config::SPEC_BINS_PER_MIDI as f32;

    for spec_bin in 0..ff_config::SPEC_BINS_NUM {
        let spec_bin_midi = lo_midi + spec_bin as f32 * spec_bin_width;

        // Each feature bin is a linear combination of two bins from
        // the spectrogram.
        // Note both arrays are monotonically decreasing in value
        let mut hi = 1;
        for (i, ac_bin_midi) in ac_bin_midis[1..half_window].iter().enumerate() {
            if spec_bin_midi > *ac_bin_midi {
                hi = 1 + i;
                break;
            }
        }
        // 'hi' => High index => Low frequency
        let delta: f32 = ac_bin_midis[hi - 1] - ac_bin_midis[hi];
        let w1: f32 = (ac_bin_midis[hi - 1] - spec_bin_midi) / delta;
        let w2: f32 = -(ac_bin_midis[hi] - spec_bin_midi) / delta;
        if w1 > 1. || w1 < 0. || w2 > 1. || w2 < 0. {
            panic!("Invalid x1: {}, x2: {}", w1, w2);
        }

        interp_indices.push(InterpInd {
            hi_weight: w1,
            lo_weight: w2,

            // The plus one here is because we excluded the DC bin from ac_bin_midis
            //  (as it's MIDI value is infinity)
            hi_index: hi + 1,
        })
    }

    return interp_indices;
}

fn hertz_to_midi(hertz: &f32) -> f32 {
    return 69. + 12. * (hertz / 440.).log2();
}
