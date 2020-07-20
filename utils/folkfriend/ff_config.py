import string
import numpy as np

# ====================================
# === SIGNAL PROCESSING PARAMETERS ===
# ====================================

# Use 48 kHz as sample rate everywhere. If anything is not this sample rate,
#   resample it before proceeding any further. This is the default sample rate
#   on the majority of modern devices so resampling should not normally be
#   required in the web app.
SAMPLE_RATE = 48000
AUDIO_QUERY_SECS = 8      # 8 Seconds for a normal short query

# Microphone records audio as 1D array of samples, denoted as
#   [1D audio samples (length)]

# Samples sizes for  short-time Fourier transform (STFT) window width.
#   Note that 48000 / 1024 = 46.875 fps
SPEC_WINDOW_SIZE = 1024
# SPEC_HOP_SIZE = 1024

# Applying this sliding window gives
#   [1D audio samples (length)] -> [2D windowed samples (num_frames, 1024)]

# Windowed samples are then multiplied by Blackman window function.

# Applying FFT gives
# [2D windowed samples (num_frames, 1024)] -> [2D spectrum (num_frames, 1024)]

# Spectrum is then magnitude compressed with an exponent (k = 0.67, see
#   https://labrosa.ee.columbia.edu/~dpwe/papers/ToloK2000-mupitch.pdf)

# Applying second FFT (RFFT) and extracting the real part only gives
# [2D spectrum (num_frames, 1024)] -> [2D spectrum (num_frames, 512)]

# ==============================
# === SPECTROGRAM PARAMETERS ===
# ==============================

# These are the extreme-most midi values that we choose to sample from the
#   generate spectrogram. The spectrogram is resampled to be linear in
#   midi space. These extreme values are inclusive, ie [LOW_MIDI, HIGH_MIDI].
MIDI_HIGH = 95  # B6 (1975.5 Hz), just over two octaves above violin open A
MIDI_LOW = 48    # C2 (130.81 Hz), an octave below middle C
MIDI_NUM = MIDI_HIGH - MIDI_LOW + 1  # =48

# When resampling we can choose how many values to interpolate.
SPEC_BINS_PER_MIDI = 5
SPEC_NUM_BINS = SPEC_BINS_PER_MIDI * MIDI_NUM
SPEC_IMG_WIDTH = (SAMPLE_RATE * AUDIO_QUERY_SECS) // SPEC_WINDOW_SIZE

# Each midi note get SPECTROGRAM_BINS_PER_MIDI bins. We centre the range of
#   each note about .0, and give plus or equal floor(0.5 *
#   SPECTROGRAM_BINS_PER_MIDI) on either side, ie for the lowest MIDI note
#   (48) the range of midi bin values is [48.4, 48.2, 48.0, 47.8, 47.6].
#   So LINEAR_MIDI_BINS = [95.4, 95.2, 95.0, ..., 48.0, 47.8, 47.6]
LINEAR_MIDI_BINS = np.linspace(
        start=MIDI_HIGH + SPEC_BINS_PER_MIDI // 2 / SPEC_BINS_PER_MIDI,
        stop=MIDI_LOW - SPEC_BINS_PER_MIDI // 2 / SPEC_BINS_PER_MIDI,
        num=SPEC_NUM_BINS,
        endpoint=True
)

# Applying spectrogram resampling
# [2D spectrum (num_frames, 512)] -> [2D spectrum (num_frames, SPEC_NUM_BINS)]

# ======================
# === CNN PARAMETERS ===
# ======================

# For model specific parameters see train.py and model.py

# How much context does each frame get in the CNN (must be even)
CONTEXT_FRAMES = 12

# Applying spectrogram denoising leaves dimensions unchanged.

# Applying RNN 'feature extraction' (nothing more than summing across the bins
#   for each note) gives
# [2D spectrum (num_frames,
#               SPEC_NUM_BINS)] -> [2D spectrum (num_frames, NUM_MIDI)]

# ======================
# === RNN PARAMETERS ===
# ======================

# abc...ABC...0123
BLANK_CHARACTER = '-'
MIDI_MAP = (string.ascii_letters + string.digits)[:MIDI_NUM] + BLANK_CHARACTER
RNN_CLASSES_NUM = len(MIDI_MAP)      # Includes blank character


# Applying RNN model gives
# [2D spectrum (num_frames, NUM_MIDI)] -> [1D array (length < num_frames)]

# Applying decoder gives
# [1D array (length < num_frames)] -> [string (length < num_frames)]

# Or the decoder step can be skipped and the array used directly as a
#   search query in the search engine.

# =================================
# === NON-PRODUCTION PARAMETERS ===
# =================================

CNN_DS_SS = 2   # Start seconds
CNN_DS_TO = CNN_DS_SS + AUDIO_QUERY_SECS    # 8 second samples

# This value can be as high as liked, but over SPECTROGRAM_IMG_WIDTH
#   and it will simply cause data to start repeating. At that value
#   there will be an immense amount of data as well, on the 100k
#   examples dataset this leads to 749 * 100k = 7.49M examples.
#   This is overkill for such a small model and would take a long
#   time to train.
CNN_DS_SAMPLES_PER_IMAGE = 200
