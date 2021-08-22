use crate::folkfriend::feature::types::{Frame, InterpInds, Window};
use crate::folkfriend::ff_config;
use rustfft::{Fft, algorithm::Radix4, num_complex::Complex};

pub fn modified_autocorrelation(
    window: Window,
    window_function: &Window, 
    fft: &Radix4<f32>,
    interp_inds: &InterpInds,
) -> Frame {
    // This is the most important signal processing step of folkfriend.
    //  starting with a 1024 sample long slice of audio signal data, use
    //  Fourier transforms to compute the 'enhanced' autocorrelation, and
    //  then perform some denoising / filtering steps to create a vector
    //  of MIDI_NUM features, where each feature is the energy associated
    //  with that MIDI pitch (i.e., musical note).

    // Define empty buffer for use with this frame
    let mut buffer: [Complex<f32>; ff_config::SPEC_WINDOW_SIZE] =
        [Complex { re: 0.0, im: 0.0 }; ff_config::SPEC_WINDOW_SIZE];
    // =============================
    // === Apply window function ===
    // =============================

    for i in 0..buffer.len() {
        buffer[i].re = window[i] * window_function[i];
    }

    // ===============================
    // === Compute autocorrelation ===
    // ===============================

    // Fourier transform of windowed signal, X(w)
    fft.process(&mut buffer);

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
    fft.process(&mut buffer);

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
    let mut frame: Frame = [0.; ff_config::MIDI_NUM as usize];
    for i in 0..ff_config::SPEC_BINS_NUM as usize {
        // Perform linear interpolation
        let hi_wt = interp_inds[i].hi_weight;
        let lo_wt = interp_inds[i].lo_weight;
        let hi_ac = buffer[interp_inds[i].hi_index].re;
        let lo_ac = buffer[interp_inds[i].hi_index - 1].re;
        let feature = hi_wt * hi_ac + lo_wt * lo_ac;
        frame[i / ff_config::SPEC_BINS_PER_MIDI as usize] += feature;
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

        while ind < frame.len() - 12 {
            should_shift.push(frame[ind + 12] > frame[ind]);
            inds.push(ind);
            ind += 12;
        }

        for (i, do_shift) in should_shift.iter().enumerate() {
            // basically if true, move up an octave and set to zero
            // if not true, continue
            if *do_shift {
                frame[inds[i] + 12] += frame[inds[i]];
                frame[inds[i]] = 0.;
            }
        }
    }

    // Noise filtering

    // Simple algorithm here - retain only the 5 most energetic features
    //  each frame. This significantly speeds up the later decoder step.

    // Tom is not very good at Rust. There's probably some things to be
    //  improved here.

    let mut enum_frames: Vec<_> = frame.iter().enumerate().collect::<Vec<_>>();
    enum_frames.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap());

    let frame_indices: Vec<usize> = enum_frames.iter().map(|a| a.0).collect();

    for i in &frame_indices
        [0..(ff_config::MIDI_NUM as usize - ff_config::RETAINED_FEATURES_PER_FRAME as usize)]
    {
        frame[*i] = 0.;
    }

    return frame;
}
