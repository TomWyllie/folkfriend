import string

# Use 48 kHz as sample rate everywhere. If anything is not this sample rate,
#   resample it before proceeding any further. This is the default sample rate
#   on the majority of modern devices so resampling should not normally be
#   required in the web app.
SAMPLE_RATE = 48000

# We trim anything outside these autocorrelation bins when making the
#   spectrogram. These correspond to frequencies;
#   48,000 / 16 = 3000.0 Hz
#   48,000 / 420 = 114.29 Hz
AC_LOW_THRESH = 16
AC_HIGH_THRESH = 420

# These are the extreme-most midi values that fit within the frequency range
#   (114.29, 3000.0) Hz, as described above.
HIGH_MIDI = 102  # F#7 (2960.0 Hz), just over two octaves above fiddle open E
LOW_MIDI = 46    # Bb2 (116.54 Hz), just over an octave below middle C
NUM_MIDI = HIGH_MIDI - LOW_MIDI - 1  # Nominally 55 (see below)

# The linear midi bins go
#   [102.   101.8   101.6   ...     46.6.   46.4    46.2]

# When we sum the frequency bins into MIDI note bins we obviously
#   should center the summation around BIN.0 (hence why BINS_PER_MIDI is
#   odd-valued. IE the bin corresponding to MIDI note 47 consists of
#   the sum of the values in frequency bins corresponding to MIDI notes
#   [47.4, 47.2, 47.0, 46.8, 46.6], to allow for notes to be slightly
#   out of pitch. This means the frequency bins (46.4, 46.2) and
#   (102.0, 101.8, 101.6) are not used and discarded. Our highest
#   MIDI note that makes it through to the RNN stage is then 101,
#   and the lowest is 47. This means we have 55 bins.

# abc...ABC...0123
MIDI_MAP = (string.ascii_letters + string.digits)[:NUM_MIDI]
BLANK_CHARACTER = '-'

# The above parameters infer a range of MIDI values which leads to
BINS_PER_MIDI = 5
# +1 because combined padding of 1 x BINS_PER_MIDI at either end
#   (+3 top, +2 bottom)
NUM_BINS = BINS_PER_MIDI * (NUM_MIDI + 1)

# Number of samples for Short-time Fourier Transform window width
SPECTROGRAM_WINDOW_SIZE = 1024
SPECTROGRAM_HOP_SIZE = 512

# How much context does each frame get in the CNN
CONTEXT_FRAMES = 16

# Take 10 second samples out of generated audio files when making the dataset
SAMPLE_START_SECS = 2
SAMPLE_END_SECS = 10
