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
HIGH_MIDI = 102     # F#7 (2960.0 Hz), just over two octaves above fiddle open E
LOW_MIDI = 46       # Bb2 (116.54 Hz), just over an octave below middle C

# The above parameters infer a range of MIDI values which leads to
BINS_PER_MIDI = 5
NUM_BINS = BINS_PER_MIDI * (HIGH_MIDI - LOW_MIDI)

SPECTROGRAM_WINDOW_SIZE = 1024
SPECTROGRAM_HOP_SIZE = 512
