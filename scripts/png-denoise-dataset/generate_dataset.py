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
    recreated from the config file).
"""

import argparse
import csv
import glob
import json
import logging
import math
import os
import pathlib
import subprocess
import sys
from scipy.io import wavfile
import imageio
import numpy as np
from folkfriend import eac
from folkfriend import ff_config
from scipy.io import wavfile
from tqdm import tqdm

logging.basicConfig()
log = logging.getLogger(__name__)

# Take 10 second samples out of generated audio files
SAMPLE_START_SECS = 2
SAMPLE_END_SECS = 12

ABC_COMMANDS = (
    'Q:1/4={tempo:d}\n'
    '%%MIDI gchordon\n'
    '%%MIDI chordprog {chord:d} octave={octave:d}\n'
    '%%MIDI program {melody:d}\n'
    '%%MIDI transpose {transpose:d}\n'
)


def generate(retain_audio):
    retain_audio = True
    config_files = list(os.listdir(config_dir.path))

    for config_filename in tqdm(config_files, ascii=True):
        # === Create this dataset entry ===
        # noinspection PyBroadException
        try:
            DatasetEntry(config_filename=config_filename,
                         retain_audio=retain_audio)
        except ConfigError as e:
            print(e)


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


class DatasetSubDir:
    DATASET_PARENT_DIR = '.'

    def __init__(self, dir_name, purge=False, require=False):
        self._path = os.path.join(DatasetSubDir.DATASET_PARENT_DIR, dir_name)

        if require and not os.path.isdir(self._path):
            raise RuntimeError(f'The directory {self._path} '
                               f'could not be found.')

        pathlib.Path(self._path).mkdir(parents=True, exist_ok=True)

        if purge:
            for f in glob.glob(os.path.join(self._path, '*')):
                os.remove(f)

    @property
    def path(self):
        return self._path


class DatasetEntry:
    def __init__(self, config_filename, retain_audio=False):
        self._config_filename = config_filename
        self._config_path = os.path.join(config_dir.path, config_filename)
        with open(self._config_path, 'r') as f:
            self._config = json.load(f)

        # Load in abcs from specified file
        self._abc_header, self._abc_body = self._load_abc()

        self._midi_x = os.path.join(midi_dir.path, f'{self.index}-x.midi')
        self._midi_y = os.path.join(midi_dir.path, f'{self.index}-y.midi')
        self._audio_x = os.path.join(audio_dir.path, f'{self.index}-x.wav')

        # Create two midi files; one which will be turned into audio to be used
        #   as input for the model, and the other which will be used to
        #   determine the output image mask for the CNN, and the label for the
        #   RNN.
        self._generate_midis()

        # Input files
        sr, samples = self._generate_audio(retain_audio)
        self._generate_spectrogram(sr, samples)

        # Label files
        pass

    def _load_abc(self):
        """Load in the abc file contents for this dataset entry"""
        with open(self._config['tune'], 'r') as f:
            abc_lines = f.readlines()
        # All ABC files are written out with exactly four lines of header
        return abc_lines[:4], abc_lines[4:]

    def _generate_midis(self):
        """Generate the midi files for this dataset entry."""

        # Insert relevant ABC commands. See documentation at
        #   https://manpages.debian.org/stretch/abcmidi/abc2midi.1.en.html
        #   http://abc.sourceforge.net/standard/abc2midi.txt
        abc_lines = self._abc_header + [ABC_COMMANDS.format(
            tempo=self._config['tempo'],
            chord=self._config['chord'],
            octave=self._config['chord_octave_shift'],
            melody=self._config['melody'],
            transpose=self._config['transpose'],
        )] + self._abc_body

        abc = ''.join(abc_lines)

        self._abc_to_midi(abc, self._midi_x, chords=True)
        self._abc_to_midi(abc, self._midi_y, chords=False)

    def _generate_audio(self, retain_audio):
        """Convert the midi file with chords to a .wav file

        This uses the FolkFriend soundfont file. Instruments in the FolkFriend
         soundfont file are:

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

        subprocess.run(
            ['fluidsynth', '-l',
             '-T', 'wav',
             '-F', self._audio_x,
             '--reverb', 'no',
             '--sample-rate', str(ff_config.SAMPLE_RATE),
             '--gain', '1.0',
             '--quiet',
             '/home/tom/sounds/folk-friend.sf2',
             self._midi_x])

        sample_rate, samples = wavfile.read(self._audio_x)

        if sample_rate != ff_config.SAMPLE_RATE:
            raise RuntimeError(f'{self._audio_x} should have a sample rate of '
                               f'{ff_config.SAMPLE_RATE}')

        samples = samples[sample_rate * SAMPLE_START_SECS:
                          sample_rate * SAMPLE_END_SECS]

        # TODO we should be able to avoid writing stereo output.
        #   fluidsynth doesn't seem to allow this, maybe the soundfont can
        #   be changed to have all samples mono?
        samples = samples.mean(axis=1)

        if samples.size != sample_rate * (SAMPLE_END_SECS - SAMPLE_START_SECS):
            raise ConfigError(f'Synthesized .wav file was too short '
                              f'({self.index}.json)')

        if retain_audio:
            wavfile.write(self._audio_x, sample_rate, samples)
            subprocess.run(['ffmpeg', '-y', '-hide_banner',
                            '-loglevel', 'panic',
                            '-i', self._audio_x,
                            '-ac', '1',
                            self._audio_x.replace('.wav', '.mp3')])

        os.remove(self._audio_x)

        return sample_rate, samples

    def _generate_spectrogram(self, sr, samples):
        spectrogram = eac.compute_ac_spectrogram(samples)
        spectrogram = eac.linearise_ac_spectrogram(spectrogram, sr)
        png_path = os.path.join(png_dir.path, f'{self.index}x.png')
        png_matrix = np.asarray(255 * spectrogram.T / np.max(spectrogram),
                                dtype=np.uint8)
        imageio.imwrite(png_path, png_matrix)

    @property
    def index(self):
        return self._config['index']

    @staticmethod
    def _abc_to_midi(abc, midi_path, chords=True):
        """Convert ABC text into a midi file."""

        # Generate MIDI file with chords and actual instruments
        captured = subprocess.run([
                                      'abc2midi', '-',
                                      '-quiet', '-silent',
                                      '' if chords else '-NGUI',
                                      '-o', midi_path
                                  ],
                                  input=abc.encode('utf-8'),
                                  capture_output=True)
        stderr = captured.stderr.decode('utf-8')
        if stderr:
            log.warning(stderr, file=sys.stderr)


class CSVMidiNoteReader(csv.DictReader):
    def __init__(self, *posargs, **kwargs):
        kwargs['fieldnames'] = ['track', 'time', 'type', 'channel',
                                'note', 'velocity']
        super().__init__(*posargs, **kwargs)


class ConfigError(Exception):
    """Raised to fail the creation of a dataset entry."""


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir',
                        default=os.path.join(str(pathlib.Path.home()),
                                             'datasets/png-cnn'),
                        help='Directory to contain the dataset files in')
    parser.add_argument('--retain-audio', action='store_true')
    args = parser.parse_args()

    DatasetSubDir.DATASET_PARENT_DIR = args.dir

    # User must have run both extract_chorded_abcs.py generate_configs.py
    abcs_dir = DatasetSubDir('abcs', require=True)
    config_dir = DatasetSubDir('configs', require=True)

    midi_dir = DatasetSubDir('midis', purge=True)
    audio_dir = DatasetSubDir('audio', purge=True)
    png_dir = DatasetSubDir('pngs', purge=True)

    generate(args.retain_audio)
