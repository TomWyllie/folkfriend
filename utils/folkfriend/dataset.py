import glob
import logging
import math
import os
import pathlib
import shutil
import subprocess
import sys

import imageio
import numpy as np
import py_midicsv
from folkfriend import eac
from folkfriend import ff_config
from folkfriend.midi import CSVMidiNoteReader
from scipy.io import wavfile

logging.basicConfig(level=logging.DEBUG,
                    format='[%(name)s:%(lineno)s] %(message)s')
log = logging.getLogger(os.path.basename(__file__))

ABC_COMMANDS = (
    'Q:1/4={tempo:d}\n'
    '%%MIDI gchordon\n'
    '%%MIDI chordprog {chord:d} octave={octave:d}\n'
    '%%MIDI program {melody:d}\n'
    '%%MIDI transpose {transpose:d}\n'
)


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
    def __init__(self, config, dirs, retain_audio):
        """Build a single entry in the folkfriend dataset"""
        self.config = config
        self._dirs = dirs
        self._retain_audio = retain_audio

        # Load in abcs from specified file
        self._abc_header, self._abc_body = self._load_abc()

        self._midi_x = self._dirs.midi_dir.chunk_path(self.index, '{:d}x.midi')
        self._midi_y = self._dirs.midi_dir.chunk_path(self.index, '{:d}y.midi')
        self._audio_x = self._dirs.audio_dir.chunk_path(self.index, '{:d}x.wav')

        # Create two midi files; one which will be turned into audio to be used
        #   as input for the model, and the other which will be used to
        #   determine the output image mask for the CNN, and the label for the
        #   RNN.
        self._generate_midis()

        # Input files
        sr, samples = self._generate_audio(self._midi_x)
        spectrogram = self._generate_spectrogram(sr, samples)
        self._save_spectrogram(spectrogram)

        # Label files
        midi_events = self._midi_as_csv(self._midi_y)

        # Generate output labels for CNN denoiser
        spec_mask = self._midi_to_pseudo_spectrogram(midi_events)
        self._save_spec_mask(spec_mask)

        # Combine the spectrogram and mask to give the expected output
        #   of the denoising step. This is then the input to the RNN
        #   decoder.
        denoised_spectrogram = self._denoise_spectrogram(spectrogram,
                                                         spec_mask)
        self._save_denoised_spectrogram(denoised_spectrogram)

        # Generate output labels for RNN decoder
        label = self._midi_to_note_contour(midi_events)
        self._save_label(label)

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
             '--gain', '1',
             '--quiet',
             '/home/tom/sounds/folk-friend.sf2',
             midi_path])

        sample_rate, samples = wavfile.read(self._audio_x)

        if sample_rate != ff_config.SAMPLE_RATE:
            raise RuntimeError(f'{self._audio_x} should have a sample rate of '
                               f'{ff_config.SAMPLE_RATE}')

        samples = samples[sample_rate * ff_config.SAMPLE_START_SECS:
                          sample_rate * ff_config.SAMPLE_END_SECS]

        # TODO we should be able to avoid writing stereo output.
        #   fluidsynth doesn't seem to allow this, maybe the soundfont can
        #   be changed to have all samples mono?
        samples = samples[:, 0]

        if samples.size < sample_rate * 2:  # 2 seconds is chosen as limit
            os.remove(self._audio_x)
            raise ConfigError(f'Synthesized .wav file was too short '
                              f'({self.index}.json)')

        if self._retain_audio:
            # TODO use ffmpeg library for python
            wavfile.write(self._audio_x, sample_rate, samples)
            subprocess.run(['ffmpeg', '-y', '-hide_banner',
                            '-loglevel', 'panic',
                            '-i', self._audio_x,
                            '-ac', '1',
                            self._audio_x.replace('.wav', '.mp3')])

        os.remove(self._audio_x)

        return sample_rate, samples

    def _midi_to_pseudo_spectrogram(self, csv_lines):
        midi_reader = CSVMidiNoteReader(csv_lines)
        return midi_reader.to_pseudo_spectrogram(
            tempo=self.config['tempo'],
            start_seconds=ff_config.SAMPLE_START_SECS,
            end_seconds=ff_config.SAMPLE_END_SECS
        )

    def _midi_to_note_contour(self, csv_lines):
        midi_reader = CSVMidiNoteReader(csv_lines)
        return midi_reader.to_note_contour(
            tempo=self.config['tempo'],
            start_seconds=ff_config.SAMPLE_START_SECS,
            end_seconds=ff_config.SAMPLE_END_SECS
        )

    def _save_spec_mask(self, spec_mask):
        png_path = self._dirs.png_dir.chunk_path(self.index, '{:d}y.png')
        imageio.imwrite(png_path, spec_mask.T)

    def _save_spectrogram(self, spectrogram):
        png_path = self._dirs.png_dir.chunk_path(self.index, '{:d}x.png')
        imageio.imwrite(png_path, spectrogram.T)

    def _save_denoised_spectrogram(self, denoised_spectrogram):
        png_path = self._dirs.png_dir.chunk_path(self.index, '{:d}z.png')
        imageio.imwrite(png_path, denoised_spectrogram.T)

    def _save_label(self, label):
        # We would rather write all of these out to one big file but this isn't
        #   possible with multiprocessing. Instead write out small files and
        #   cat them all right at the end.
        label_path = self._dirs.label_dir.chunk_path(self.index, '{:d}.txt')
        with open(label_path, 'w') as f:
            f.write(label)

    @property
    def index(self):
        return self.config['index']

    @staticmethod
    def _generate_spectrogram(sr, samples):
        spectrogram = eac.compute_ac_spectrogram(samples)
        spectrogram = eac.linearise_ac_spectrogram(spectrogram, sr)
        spectrogram = np.asarray(255 * spectrogram / np.max(spectrogram),
                                 dtype=np.uint8)
        return spectrogram

    @staticmethod
    def _denoise_spectrogram(spectrogram, spec_mask):
        """Apply the computed mask to the computed spectrogram"""
        denoised = spectrogram * (spec_mask[:spectrogram.shape[0]] / 255)
        denoised = denoised.T
        denoised = denoised[2:-3, :]
        denoised = denoised.reshape(
            denoised.shape[0] // 5, 5, -1).sum(axis=1).T
        return np.asarray(255 * denoised / np.max(denoised), dtype=np.uint8)

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
