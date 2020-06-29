"""
    For each config file given, create an ABC file with the necessary
    instruments and synthesise the MIDI files with and without accompaniment.

    For the base MIDI file then run midicsv, read back in the csv, and create
    a pseudo-spectrogram binary mask for the CNN to train on. Save this as a
    png.

    For the accompanied MIDI file, synthesise a .wav file, mix in any specified
    background noise or other corruptions, take the EAC spectrogram and save
    the resulting png. Do a sanity check to make sure the 'input' png has the
    same dimensions as the binary mask png.

    Convert the .wav file to a heavily compressed .mp3 file in case we ever
    want to listen back to the data (although it should be able to be exactly
    recreated from the config file, barring and stochasticity) and then remove
    the relatively large .wav file.
"""

import argparse
import csv
import glob
import json
import math
import os
import pathlib
import subprocess
import tempfile

import imageio
import numpy as np
from scipy.io import wavfile
from tqdm import tqdm

from folkfriend import eac
from folkfriend import ff_config

# Take 10 second samples out of generated audio files
SAMPLE_START_SECS = 2
SAMPLE_END_SECS = 12


def main(dataset_dir):
    """
        Instruments in the FolkFriend soundfont file are:

        Bank:Instrument Description
        000:000 Grand Piano
        000:001 Violin
        000:002 Accordion
        000:003 Flute
        000:004 Recorder
        000:005 Banjo
        000:006 Mandolin
        000:007 Clarinet
        000:008 Oboe
        000:009 Pan Flute
        000:010 Harp
        000:040 Nylon String Guitar
        000:041 Steel String Guitar
        000:042 Jazz Guitar
        000:043 Clean Guitar
        000:044 Palm Muted Guitar
        000:045 Distortion Guitar
        000:046 Overdrive Guitar
        000:047 Acoustic Bass
        000:048 Fingered Bass
        000:049 Picked Bass
    """

    abc_template_x = (
        '{abc_header}\n'
        'Q:1/4={tempo:d}\n'
        '%%MIDI gchordon\n'
        '%%MIDI chordprog {chord:d} octave={octave:d}\n'
        '%%MIDI program {melody:d}\n'
        '{abc_body}'
    )

    abc_template_y = (
        '{abc_header}\n'
        'Q:1/4={tempo:d}\n'
        '%%MIDI gchordoff\n'
        '{abc_body}'
    )

    abcs_dir = os.path.join(dataset_dir, 'abcs')
    config_dir = os.path.join(dataset_dir, 'configs')
    temp_dir = os.path.join(tempfile.gettempdir(), 'png-cnn')
    # temp_dir = '/home/tom/tmp'
    png_dir = os.path.join(dataset_dir, 'pngs')
    mp3_dir = os.path.join(dataset_dir, 'mp3s')
    pathlib.Path(temp_dir).mkdir(parents=True, exist_ok=True)
    pathlib.Path(png_dir).mkdir(parents=True, exist_ok=True)
    pathlib.Path(mp3_dir).mkdir(parents=True, exist_ok=True)

    for required_dir in (abcs_dir, config_dir):
        if not os.path.isdir(required_dir):
            raise RuntimeError('Could not find path {}'.format(required_dir))

    # Empty existing pngs
    files = glob.glob(os.path.join(png_dir, '*'))
    for f in files:
        os.remove(f)

    # Empty existing mp3s
    files = glob.glob(os.path.join(mp3_dir, '*'))
    for f in files:
        os.remove(f)

    config_files = list(os.listdir(config_dir))

    for config_file in tqdm(config_files, ascii=True):
        with open(os.path.join(config_dir, config_file), 'r') as f:
            config = json.load(f)

        with open(config['tune'], 'r') as f:
            abc_lines = f.read().split('\n')
            # All ABC files are written out with exactly four lines of header
            abc_header = '\n'.join(abc_lines[:4])
            abc_body = '\n'.join(abc_lines[4:])

        x_abc_path = os.path.join(temp_dir, '{:d}x.abc'.format(config['index']))
        with open(x_abc_path, 'w') as f:
            # Insert relevant ABC commands. See documentation at
            #   https://manpages.debian.org/stretch/abcmidi/abc2midi.1.en.html
            #   http://abc.sourceforge.net/standard/abc2midi.txt
            f.write(abc_template_x.format(
                abc_header=abc_header,
                tempo=config['tempo'],
                chord=config['chord'],
                octave=config['chord_octave_shift'],
                melody=config['melody'],
                abc_body=abc_body
            ))

        y_abc_path = os.path.join(temp_dir, '{:d}y.abc'.format(config['index']))
        with open(y_abc_path, 'w') as f:
            # Insert relevant ABC commands. See documentation at
            #   https://manpages.debian.org/stretch/abcmidi/abc2midi.1.en.html
            #   http://abc.sourceforge.net/standard/abc2midi.txt
            f.write(abc_template_y.format(
                abc_header=abc_header,
                tempo=config['tempo'],
                abc_body=abc_body
            ))

        x_midi_path = os.path.join(temp_dir,
                                   '{:d}x.midi'.format(config['index']))
        y_midi_path = os.path.join(temp_dir,
                                   '{:d}y.midi'.format(config['index']))

        # Generate MIDI file with chords and actual instruments
        captured = subprocess.run(['abc2midi', x_abc_path, '-quiet', '-silent',
                                   '-o', x_midi_path], capture_output=True)
        stderr = captured.stderr.decode('utf-8')
        if stderr:
            print(stderr)

        # Generate MIDI file without chords or grace notes just for making the
        #   pseudo-spectrogram.
        captured = subprocess.run(['abc2midi', y_abc_path, '-quiet',
                                   '-silent', '-NGRA', '-NGUI', '-o',
                                   y_midi_path], capture_output=True)
        stderr = captured.stderr.decode('utf-8')
        if stderr:
            print(stderr)

        try:
            generate_input_spectrogram(x_midi_path, config['index'], temp_dir,
                                       png_dir, mp3_dir)
            generate_pseudo_spectrogram(y_midi_path, config['index'],
                                        config['tempo'], png_dir)
        except ValueError as e:
            print('Error occurred in file {}'.format(config_file))
            print(e)
            continue


def generate_pseudo_spectrogram(midi_path, index, bpm, png_dir):
    midi_as_csv = subprocess.run(['midicsv', midi_path], capture_output=True)
    lines = midi_as_csv.stdout.decode('utf-8').split('\n')
    csv_lines = (line.replace(', ', ',') for line in lines)

    sample_duration = (SAMPLE_END_SECS - SAMPLE_START_SECS)
    num_frames = ((ff_config.SAMPLE_RATE * sample_duration
                   ) // ff_config.SPECTROGRAM_HOP_SIZE) - 1
    num_bins = ff_config.NUM_BINS

    # Length in seconds of one frame
    frame_length = ff_config.SPECTROGRAM_HOP_SIZE / ff_config.SAMPLE_RATE

    # Times in seconds of frames, after the start point
    frame_times_s = frame_length * np.arange(num_frames)

    # Times in seconds of frames thresholds, after the start point.
    #   See spacing.png for why there's an extra half here.
    frame_times_s += frame_length / 2

    # Add start offset
    frame_times_s += SAMPLE_START_SECS

    # Convert to milliseconds
    frame_times_ms = 1000 * frame_times_s

    active_notes = {}
    us_per_crotchet = 60000000 / bpm

    # This 480,000 comes from 125 bpm being the default tempo with the hard
    #   coded midi times (240ms = 1 quaver)
    ms_scale_factor = us_per_crotchet / 480000

    pseudo_spectrogram = np.zeros((num_frames, num_bins), dtype=np.uint8)

    for record in CSVMidiNoteReader(csv_lines):
        if not record['note'] or not record['note'].isdigit():
            continue
        note = int(record['note'])
        time = ms_scale_factor * int(record['time'])

        if record['type'] == 'Note_on_c':
            if note not in active_notes:
                active_notes[note] = time
        elif record['type'] == 'Note_off_c':
            if note not in active_notes:
                continue

            # Now update the pseudo-spectrogram matrix with this start / end
            #   time and note.
            note_end = time
            note_start = active_notes.pop(note)
            if note_end < 1000 * SAMPLE_START_SECS:
                continue

            start_frame = np.argmax(frame_times_ms > note_start)

            if note_start < frame_times_ms[-1] < note_end:
                # RHS edge case
                end_frame = num_frames
            else:
                end_frame = np.argmax(frame_times_ms > note_end)

            if end_frame <= start_frame:
                # argmax can return 0 if no matches
                continue

            # Invalid note
            if not ff_config.LOW_MIDI < note < ff_config.HIGH_MIDI:
                continue

            # -1 because inclusive range. The linear midi bins go
            #   [102.   101.8   101.6   ...     46.6.   46.4    46.2]
            lo_index = (math.ceil(ff_config.BINS_PER_MIDI / 2)
                        + ff_config.BINS_PER_MIDI
                        * (ff_config.HIGH_MIDI - 1 - note))
            hi_index = lo_index + ff_config.BINS_PER_MIDI

            pseudo_spectrogram[start_frame: end_frame, lo_index: hi_index] = 255

    out_path = os.path.join(png_dir, '{}y.png'.format(index))
    imageio.imwrite(out_path, pseudo_spectrogram.T)


def generate_input_spectrogram(midi_path, index, temp_dir, png_dir, mp3_dir):
    # Synthesize a .wav file from this midi. Trim to length and take the EAC.
    #   also encode an .mp3 of the trimmed segment.

    """
    fluidsynth -l -T raw -F - ~/sounds/folk-friend.sf2 <MIDI FILE PATH> \
    | sox -t raw -r 48000 -e signed -b 16 -c 1 - <OUTPUT WAV>
    """

    trimmed_midi_path = trim_midi(midi_path)

    temp_wav_path = os.path.join(temp_dir, 'audio.wav')
    temp_short_wav_path = os.path.join(temp_dir, 'short-audio.wav')
    subprocess.run(
        ['fluidsynth', '-l', '-T', 'wav', '-F', temp_wav_path, '--reverb', 'no',
         '--quiet', '-r', str(ff_config.SAMPLE_RATE), '--gain', '1',
         '/home/tom/sounds/folk-friend.sf2', trimmed_midi_path])

    # Trim to length
    subprocess.run(
        ['ffmpeg', '-y', '-hide_banner', '-loglevel', 'panic', '-i',
         temp_wav_path, '-ss', str(SAMPLE_START_SECS), '-ac', '1',
         '-to', str(SAMPLE_END_SECS), temp_short_wav_path])

    # Perform linearised AC on short audio file
    sample_rate, samples = wavfile.read(temp_short_wav_path)

    if sample_rate != ff_config.SAMPLE_RATE:
        raise RuntimeError('The provided input audio file should have a sample'
                           'rate of {:d}'.format(ff_config.SAMPLE_RATE))

    spectrogram = eac.compute_ac_spectrogram(samples)
    png_out_path = os.path.join(png_dir, '{:d}x.png'.format(index))
    spectrogram = eac.linearise_ac_spectrogram(spectrogram, sample_rate)
    img_matrix = np.asarray(255 * spectrogram.T / np.max(spectrogram),
                            dtype=np.uint8)
    imageio.imwrite(png_out_path, img_matrix)

    # Compress original audio file
    mp3_out_path = os.path.join(mp3_dir, '{:d}.mp3'.format(index))
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'panic', '-i',
                    temp_short_wav_path, '-codec:a', 'libmp3lame', '-qscale:a',
                    '4', mp3_out_path])


def trim_midi(midi_path):
    """Remove all midi events after the SAMPLE_END_SECS. This means we don't
        synthesize the audio for parts of the file that will be trimmed away,
        greatly speeding up the generation of the dataset."""

    midi_as_csv = subprocess.run(['midicsv', midi_path], capture_output=True)
    lines = midi_as_csv.stdout.decode('utf-8').split('\n')
    csv_lines = (line.replace(', ', ',') for line in lines)

    filtered_lines = []
    last_events = {}

    base_threshold_ms = SAMPLE_END_SECS * 1000
    threshold_ms = base_threshold_ms

    for line, record in zip(lines, CSVMidiNoteReader(csv_lines)):
        t = record['track']
        ms = int(record['time'])

        if record['type'] == 'Tempo':
            us_per_crotchet = int(record['channel'])
            # 480,000 is default, this is what the ms are written in.
            threshold_ms = int(base_threshold_ms * 480000 / us_per_crotchet)

        if ms < threshold_ms:
            filtered_lines.append(line)
            last_events[t] = max(last_events.get(t, 0), ms)
        elif record['type'] == 'End_track':
            filtered_lines.append('{}, {:d}, End_track'.format(t, threshold_ms))

    trimmed_midi_path = midi_path + '.trim'
    subprocess.run(['csvmidi', '-', trimmed_midi_path],
                   input='\n'.join(filtered_lines).encode('utf-8'))
    return trimmed_midi_path


class CSVMidiNoteReader(csv.DictReader):
    def __init__(self, *posargs, **kwargs):
        kwargs['fieldnames'] = ['track', 'time', 'type', 'channel',
                                'note', 'velocity']
        super().__init__(*posargs, **kwargs)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir',
                        default=os.path.join(str(pathlib.Path.home()),
                                             'datasets/png-cnn'),
                        help='Directory to contain the dataset files in')
    args = parser.parse_args()
    main(args.dir)
