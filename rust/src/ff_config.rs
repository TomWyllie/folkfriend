// Stores important global parameters that are re-used across FolkFriend.
// MAKE SURE THIS MATCHES CARGO.TOML
pub const VERSION: &str = "1.0.0";

// ====================================
// === Signal Processing Paramaters ===
// ====================================

// The range of MIDI pitches that folkfriend supports. These extrema are 
//  inclusive, i.e. the support is [LOW_MIDI, HIGH_MIDI].
pub const MIDI_HIGH: u32 = 95;                      // B6 (1975.5 Hz), just over two octaves above violin open A
pub const MIDI_LOW: u32 = 48;                       // C2 (130.81 Hz), an octave below middle C
pub const MIDI_NUM: u32 = MIDI_HIGH - MIDI_LOW + 1; // =48

// The features are formed by computing the values at SPEC_BINS_PER_MIDI
//  different frequencies, linearly spaced from the frequency of MIDI note
//  MIDI_LOW - edge to frequency MIDI_HIGH + edge
pub const SPEC_BINS_PER_MIDI: u32 = 3;
pub const SPEC_BINS_NUM: u32 = SPEC_BINS_PER_MIDI * MIDI_NUM;

// Here, "edge" is given by ..., e.g.
// SPEC_BINS_PER_MIDI   Lowest MIDI value   Edge
//  1                   48.0                0.0
//  2                   47.75               0.25
//  3                   47.66               0.33
//  4                   47.


// Samples sizes for  short-time Fourier transform (STFT) window width. Note
//  that 48000 / 1024 = 46.875 fps, but the framerate may vary slightly with
//  sample rate. Folkfriend doesn't presume tempo so this isn't problematic.
pub const SPEC_WINDOW_SIZE: usize = 1024;

// The input sample rate is not fixed. In practice, it will almost always be
//  48 kHz or 44.1 kHz. The input signal is not resampled before processing
//  but the sample rate is taken into account during frequency analysis.
//  However, the sample rate must be sufficient to capture the range of pitches
//  specified above.

// The highest frequency that can be encoded by a signal at sample rate N is
//  the frequency N/2 ("Nyquist frequency"). To capture note B6, 1975.53 Hz, a
//  sample rate of *at least* 3952 Hz is required.
pub const SAMPLE_RATE_MIN: u32 = 3952;

// The frequency domain analysis is a modified autocorrelation. Bin N of the
//  autocorrelation corresponds to the frequency sample_rate / N. The spectral
//  window size is fixed however. The maximum bin is the 512th bin so the
//  lowest frequency is sample_rate / 512. To capture C2, 130.81 Hz the sample
//  rate can be no higher than 66,974 Hz.
pub const SAMPLE_RATE_MAX: u32 = 66_974;

// Initialise feature extraction with this. It's usually this.
pub const SAMPLE_RATE_DEFAULT: u32 = 48_000;

// Retain only this many features
pub const RETAINED_FEATURES_PER_FRAME: u32 = 5;

pub const PITCH_MODEL_WEIGHT: f32 = 0.12;
pub const TEMPO_MODEL_WEIGHT: f32 = 0.40;

pub const BEAM_WIDTH: usize = 20;

// TODO experiment with varying this tempo parameter.
pub const TEMP_TEMPO_PARAM: f32 = 8.0;

pub const CONTOUR_TO_QUERY_CHAR: [char; MIDI_NUM as usize] = [
    'a', 'b', 'c', 'd', 'e', 
    'f', 'g', 'h', 'i', 'j', 
    'k', 'l', 'm', 'n', 'o',
    'p', 'q', 'r', 's', 't', 
    'u', 'v', 'w', 'x', 'y', 
    'z', 'A', 'B', 'C', 'D',
    'E', 'F', 'G', 'H', 'I',
    'J', 'K', 'L', 'M', 'N',
    'O', 'P', 'Q', 'R', 'S',
    'T', 'U', 'V'
];

// Just found in testing that with musical notes 4 is better
//  and with searching strings for names 3 seems to be better :)
pub const QUERY_NGRAM_SIZE_CONTOUR: usize = 4;  // "quadgram"
pub const QUERY_NGRAM_SIZE_NAME: usize = 3;     // "trigram"
pub const QUERY_REPASS_SIZE: usize = 1200;