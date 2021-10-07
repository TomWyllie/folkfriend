from folkfriend import ff_config
from folkfriend.sig_proc import spectrogram
from folkfriend.decoder import decoder

def transcribe(signal, sample_rate):
    assert sample_rate == ff_config.SAMPLE_RATE

    # Waveform -> frequency domain
    ac_spec = spectrogram.compute_ac_spectrogram(signal)

    # Spectrogram processing steps
    linear_ac_spec = spectrogram.linearise_ac_spectrogram(ac_spec)
    # pitch_spec = spectrogram.detect_pitches(linear_ac_spec)
    onset_spec = spectrogram.sum_to_midis(linear_ac_spec)
    fixed_octaves = spectrogram.fix_octaves(onset_spec)
    noise_cleaned = spectrogram.clean_noise(fixed_octaves)

    # Spectrogram -> sequence of notes
    contour = decoder.decode(noise_cleaned)
    midi_seq = decoder.contour_to_midi_seq(contour)
    query = decoder.midi_seq_to_query(midi_seq)

    return query
    