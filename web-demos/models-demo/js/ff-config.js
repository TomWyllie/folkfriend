"use strict";

// import string
// import numpy as np

// TODO go through this file properly and explain / unify some of the messy bits
//   particularly number of bins across different bits.

// Use 48 kHz as sample rate everywhere. If anything is not this sample rate,
//   resample it before proceeding any further. This is the default sample rate
//   on the majority of modern devices so resampling should not normally be
//   required in the web app.
export const SAMPLE_RATE = 48000

// Number of samples for Short-time Fourier Transform window width
export const SPECTROGRAM_WINDOW_SIZE = 1024
export const SPECTROGRAM_HOP_SIZE = 512

// We trim anything outside these autocorrelation bins when making the
//   spectrogram. These correspond to frequencies;
//   48,000 / 16 = 3000.0 Hz
//   48,000 / 420 = 114.29 Hz
export const AC_LOW_THRESH = 16
export const AC_HIGH_THRESH = 420

// These are the extreme-most midi values that fit within the frequency range
//   (114.29, 3000.0) Hz, as described above.
export const HIGH_MIDI = 102  // F//7 (2960.0 Hz), just over two octaves above fiddle open E
export const LOW_MIDI = 46    // Bb2 (116.54 Hz), just over an octave below middle C
export const NUM_MIDI = HIGH_MIDI - LOW_MIDI - 1  // Nominally 55 (see below)


// When we sum the frequency bins into MIDI note bins we obviously
//   should center the summation around BIN.0 (hence why BINS_PER_MIDI is
//   odd-valued. IE the bin corresponding to MIDI note 47 consists of
//   the sum of the values in frequency bins corresponding to MIDI notes
//   [47.4, 47.2, 47.0, 46.8, 46.6], to allow for notes to be slightly
//   out of pitch. This means the frequency bins (46.4, 46.2) and
//   (102.0, 101.8, 101.6) are not used and discarded. Our highest
//   MIDI note that makes it through to the RNN stage is then 101,
//   and the lowest is 47. This means we have 55 bins.

// The above parameters infer a range of MIDI values which leads to
export const BINS_PER_MIDI = 5
// +1 because combined padding of 1 x BINS_PER_MIDI at either end
//   (+3 top, +2 bottom)
export const NUM_BINS = BINS_PER_MIDI * (NUM_MIDI + 1)

// The linear midi bins go
//   [102.   101.8   101.6   ...     46.6.   46.4    46.2]
// LINEAR_MIDI_BINS = np.linspace(
//         start=HIGH_MIDI,
//         stop=LOW_MIDI,
//         num=275,
//         endpoint=False
//     )

// TODO explain better
export const SPECTROGRAM_IMG_WIDTH = 749
export const SPECTROGRAM_IMG_HEIGHT = 275

// How much context does each frame get in the CNN (must be even)
export const CONTEXT_FRAMES = 16

export const MIDI_MAP = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012"