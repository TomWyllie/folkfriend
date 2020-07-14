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
import shutil
import subprocess
import sys
import timeit
from multiprocessing import Pool

import imageio
import numpy as np
from folkfriend import eac
from folkfriend import ff_config
from folkfriend.midi import CSVMidiNoteReader
from scipy.io import wavfile
import py_midicsv

logging.basicConfig(level=logging.DEBUG,
                    format='[%(name)s:%(lineno)s] %(message)s')
log = logging.getLogger(os.path.basename(__file__))

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


def generate(config_files):
    log.info(f'Beginning processing {len(config_files)} files')
    start_time = timeit.default_timer()

    with Pool() as p:
        p.map(create_entry_wrapper, config_files)

    log.info('Done in {:.3f} seconds'.format(
        timeit.default_timer() - start_time))


def create_entry_wrapper(config):
    # === Create this dataset entry ===
    log.info(f"Processing config {config['index']}")
    # noinspection PyBroadException
    try:
        DatasetEntry(config=config)
    except ConfigError as e:
        log.warning(e)
    except Exception as e:
        log.exception(e)


class DatasetSubDir:
    DS_DIR = os.path.join(str(pathlib.Path.home()), 'datasets/folkfriend')
    DS_SIZE = 100

    def __init__(self, dir_name, purge=False, require=False):
        self._path = os.path.join(DatasetSubDir.DS_DIR, dir_name)
        self._chunk_size = 200

        if require and not os.path.isdir(self._path):
            raise RuntimeError(f'The directory {self._path} '
                               f'could not be found.')

        pathlib.Path(self._path).mkdir(parents=True, exist_ok=True)

        if purge:
            for f in glob.glob(os.path.join(self._path, '*')):
                shutil.rmtree(f)

        self._chunk_paths = {}
        for chunk in range(math.ceil(DatasetSubDir.DS_SIZE / self._chunk_size)):
            chunk_dir_path = os.path.join(self._path, str(chunk))
            pathlib.Path(chunk_dir_path).mkdir(parents=True, exist_ok=True)
            self._chunk_paths[chunk] = chunk_dir_path

    def chunk_path(self, index, pattern):
        chunk_dir = self._chunk_paths[index // self._chunk_size]
        return os.path.join(chunk_dir, pattern.format(index))


class DatasetEntry:
    def __init__(self, config):
        self.config = config

        # Load in abcs from specified file
        self._abc_header, self._abc_body = self._load_abc()

        self._midi_x = midi_dir.chunk_path(self.index, '{:d}x.midi')
        self._midi_y = midi_dir.chunk_path(self.index, '{:d}y.midi')
        self._audio_x = audio_dir.chunk_path(self.index, '{:d}x.wav')

        # Create two midi files; one which will be turned into audio to be used
        #   as input for the model, and the other which will be used to
        #   determine the output image mask for the CNN, and the label for the
        #   RNN.
        self._generate_midis()

        # Input files
        sr, samples = self._generate_audio(self._midi_x)
        self._generate_spectrogram(sr, samples)

        # Label files
        midi_events = self._midi_as_csv(self._midi_y)

        # Generate output labels for CNN denoiser
        spec_mask = self._midi_to_pseudo_spectrogram(midi_events)
        self._save_spec_mask(spec_mask)

        # Generate output labels for RNN decoder
        # label = self._midi_to_note_contour(midi_events)
        # self._save_label(label)

    def _load_abc(self):
        """Load in the abc file contents for this dataset entry"""
        with open(self.config['tune'], 'r') as f:
            abc_lines = f.readlines()
        # All ABC files are written out with exactly four lines of header
        return abc_lines[:4], abc_lines[4:]

    def _generate_midis(self):
        """Generate the midi files for this dataset entry."""

        # Insert relevant ABC commands. See documentation at
        #   https://manpages.debian.org/stretch/abcmidi/abc2midi.1.en.html
        #   http://abc.sourceforge.net/standard/abc2midi.txt
        abc_lines = self._abc_header + [ABC_COMMANDS.format(
            tempo=self.config['tempo'],
            chord=self.config['chord'],
            octave=self.config['chord_octave_shift'],
            melody=self.config['melody'],
            transpose=self.config['transpose'],
        )] + self._abc_body

        abc = ''.join(abc_lines)

        self._abc_to_midi(abc, self._midi_x, chords=True)
        self._abc_to_midi(abc, self._midi_y, chords=False)

    def _generate_audio(self, midi_path):
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
             midi_path])

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

        if samples.size < sample_rate * 2:      # 2 seconds is chosen as limit
            os.remove(self._audio_x)
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
        png_path = png_dir.chunk_path(self.index, '{:d}x.png')
        png_matrix = np.asarray(255 * spectrogram.T / np.max(spectrogram),
                                dtype=np.uint8)
        imageio.imwrite(png_path, png_matrix)

    def _midi_to_pseudo_spectrogram(self, csv_lines):
        midi_reader = CSVMidiNoteReader(csv_lines)
        return midi_reader.to_pseudo_spectrogram(
            tempo=self.config['tempo'],
            start_seconds=SAMPLE_START_SECS,
            end_seconds=SAMPLE_END_SECS
        )

    def _midi_to_note_contour(self, csv_lines):
        midi_reader = CSVMidiNoteReader(csv_lines)
        return midi_reader.to_note_contour(
            tempo=self.config['tempo'],
            start_seconds=SAMPLE_START_SECS,
            end_seconds=SAMPLE_END_SECS
        )

    def _save_spec_mask(self, spec_mask):
        png_path = png_dir.chunk_path(self.index, '{:d}y.png')
        imageio.imwrite(png_path, spec_mask.T)

    def _save_label(self, label):
        # We would rather write all of these out to one big file but this isn't
        #   possible with multiprocessing. Instead write out small files and
        #   cat them all right at the end.
        label_path = label_dir.chunk_path(self.index, '{:d}.txt')
        with open(label_path, 'w') as f:
            f.write(label)

    @property
    def index(self):
        return self.config['index']

    @staticmethod
    def _midi_as_csv(midi_path):
        midi_lines = py_midicsv.midi_to_csv(midi_path)
        return [line.strip().replace(', ', ',') for line in midi_lines]

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


class ConfigError(Exception):
    """Raised to fail the creation of a dataset entry."""


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dir',
                        default=os.path.join(str(pathlib.Path.home()),
                                             'datasets/folkfriend'),
                        help='Directory to contain the dataset files in')
    parser.add_argument('--retain-audio', action='store_true')
    parser.add_argument('-vf', '--val-fraction', default=0.1, type=float,
                        help='Use this fraction of the dataset as validation'
                             'data when training.')
    args = parser.parse_args()

    if not 0 <= args.val_fraction < 1:
        raise ValueError('Validation Fraction must belong to [0, 1)')

    val_fraction = args.val_fraction
    retain_audio = args.retain_audio
    DatasetSubDir.DS_DIR = args.dir

    with open(os.path.join(args.dir, 'configs.json')) as config_file:
        configs = json.load(config_file)
    DatasetSubDir.DS_SIZE = len(configs)

    # User must have run both extract_chorded_abcs.py generate_configs.py
    abcs_dir_path = os.path.join(args.dir, 'abcs')  # TODO switch to JSON

    midi_dir = DatasetSubDir('midis', purge=True)
    audio_dir = DatasetSubDir('audio', purge=True)
    png_dir = DatasetSubDir('pngs', purge=True)
    label_dir = DatasetSubDir('labels', purge=True)

    generate(configs)
