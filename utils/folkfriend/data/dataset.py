import glob
import logging
import math
import os
import pathlib
import shutil
import subprocess

import imageio
import numpy as np
from folkfriend import ff_config
from folkfriend.data import data_ops
from folkfriend.data import midi
from folkfriend.sig_proc.spectrogram import (linearise_ac_spectrogram,
                                             compute_ac_spectrogram)
from scipy.io import wavfile

logging.basicConfig(level=logging.DEBUG,
                    format='[%(name)s:%(lineno)s] %(message)s')
log = logging.getLogger(os.path.basename(__file__))


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
    def __init__(self, config, dirs, thesession_data, retain_audio):
        """Build a single entry in the folkfriend dataset"""
        self.config = config
        self._dirs = dirs
        self._retain_audio = retain_audio
        self._thesession_data = thesession_data

        self._midi_a = self._dirs.midi_dir.chunk_path(self.index, '{:d}a.midi')
        self._audio_a = self._dirs.audio_dir.chunk_path(self.index, '{:d}a.wav')
        self._abc_a = self._dirs.abc_dir.chunk_path(self.index, '{:d}a.abc')

        self._midi_b = self._dirs.midi_dir.chunk_path(self.index, '{:d}b.midi')
        self._abc_b = self._dirs.abc_dir.chunk_path(self.index, '{:d}b.abc')

        # Generate the midi files for this dataset entry.

        # Create two midi files; one which will be turned into audio to be used
        # as input for the model, and the other which will be used to
        # determine the output image mask for the CNN.

        # Non-clean input with chords and potentially extra voices included in
        #   the midi file
        abc_a = self._generate_abc(clean=False)
        self._save_abc(abc_a, self._abc_a)
        midi.abc_to_midi(abc_a, self._midi_a, clean=False)

        # Clean output
        abc_b = self._generate_abc(clean=True)
        self._save_abc(abc_b, self._abc_b)
        midi.abc_to_midi(abc_b, self._midi_b, clean=True)

        # Input files
        sr, samples = self._generate_audio(self._midi_a)
        spectrogram = self._generate_spectrogram(samples)
        self._save_spectral_image(spectrogram, 'a')

        # Label files
        midi_events = midi.midi_as_csv(self._midi_b)

        # Generate output labels for CNN denoiser
        spec_mask = self._midi_to_pseudo_spectrogram(midi_events)
        expanded_mask = data_ops.pseudo_to_spec(spec_mask)

        # (b) Just for visual inspection that masks line up
        self._save_spectral_image(255 * expanded_mask, 'b')
        self._save_spectral_image(255 * spec_mask, 'c')

        # Combine the spectrogram and mask to give the expected output
        #   of the denoising step. This is then the input to the RNN
        #   decoder.
        denoised_spectrogram = self._denoise_spectrogram(spectrogram,
                                                         spec_mask)
        self._save_spectral_image(denoised_spectrogram, 'd')

        # Generate output labels for RNN decoder
        # label = self._midi_to_note_contour(midi_events)
        # self._save_label(label)

    def _generate_abc(self, clean):
        """Generate abc file contents for this dataset entry"""
        tune = self._thesession_data[self.config['tune']]
        abc_header = [
            'X:1',
            'T:',
            f'M:{tune["meter"].strip()}',
            f'K:{tune["mode"].strip()}'
        ]
        abc_body = tune['abc'].replace('\\', '').replace('\r', '').split('\n')

        tempo = self.config['tempo']
        chords = self.config['chords']
        octaves = self.config['chord_octave_shifts']
        melodies = self.config['melodies']
        transpositions = self.config['transpositions']

        chords = [None] if clean else chords

        # Allow all melodies
        # melodies = melodies[:1] if clean else melodies

        chords += (len(melodies) - len(chords)) * [None]

        # Insert relevant ABC commands. See documentation at
        #   https://manpages.debian.org/stretch/abcmidi/abc2midi.1.en.html
        #   http://abc.sourceforge.net/standard/abc2midi.txt
        abc_lines = abc_header + ['Q:1/4={:d}'.format(tempo)]

        for i, (melody, chord) in enumerate(zip(melodies, chords)):
            if chord:
                abc_lines.append('%%MIDI gchordon')
                abc_lines.append('%%MIDI chordprog {:d} octave={:d}'.format(
                    chord, octaves[i]))
            else:
                abc_lines.append('%%MIDI gchordoff')
            abc_lines.extend([
                                 'V:{:d}'.format(i + 1),
                                 '%%MIDI program {:d}'.format(melody),
                                 '%%MIDI transpose {:d}'.format(transpositions[i])
                             ] + abc_body)

        return '\n'.join(abc_lines)

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
             '-F', self._audio_a,
             '--reverb', 'no',
             '--sample-rate', str(ff_config.SAMPLE_RATE),
             '--gain', '1',
             '--quiet',
             '/home/tom/sounds/folk-friend.sf2',
             midi_path])

        sample_rate, samples = wavfile.read(self._audio_a)

        if sample_rate != ff_config.SAMPLE_RATE:
            raise RuntimeError(f'{self._audio_a} should have a sample rate of '
                               f'{ff_config.SAMPLE_RATE}')

        samples = samples[sample_rate * ff_config.CNN_DS_SS_:
                          sample_rate * ff_config.CNN_DS_TO_]

        # TODO we should be able to avoid writing stereo output.
        #   fluidsynth doesn't seem to allow this, maybe the soundfont can
        #   be changed to have all samples mono?
        samples = samples[:, 0]

        if samples.size < sample_rate * 2:  # 2 seconds is chosen as limit
            os.remove(self._audio_a)
            raise ConfigError(f'Synthesized .wav file was too short '
                              f'({self.index}.json)')

        if self._retain_audio:
            # TODO use ffmpeg library for python
            wavfile.write(self._audio_a, sample_rate, samples)
            subprocess.run(['ffmpeg', '-y', '-hide_banner',
                            '-loglevel', 'panic',
                            '-i', self._audio_a,
                            '-ac', '1',
                            self._audio_a.replace('.wav', '.mp3')])

        os.remove(self._audio_a)

        return sample_rate, samples

    def _midi_to_pseudo_spectrogram(self, csv_lines):
        midi_reader = midi.CSVMidiNoteReader(csv_lines)
        return midi_reader.to_spectrogram_mask(
            tempo=self.config['tempo'],
            start_seconds=ff_config.CNN_DS_SS_,
            end_seconds=ff_config.CNN_DS_TO_
        )

    # def _midi_to_note_contour(self, csv_lines):
    #     midi_reader = midi.CSVMidiNoteReader(csv_lines)
    #     return midi_reader.to_midi_contour(
    #         tempo=self.config['tempo'],
    #         start_seconds=ff_config.CNN_DS_SS_,
    #         end_seconds=ff_config.CNN_DS_TO_
    #     )

    @staticmethod
    def _save_abc(abc, path):
        with open(path, 'w') as f:
            f.write(abc)

    def _save_spectral_image(self, spec, stage):
        img_name = '{:d}' + f'{stage}.png'
        png_path = self._dirs.png_dir.chunk_path(self.index, img_name)
        imageio.imwrite(png_path, spec.T)

    # def _save_label(self, label):
        # We would rather write all of these out to one big file but this isn't
        #   possible with multiprocessing. Instead write out small files and
        #   cat them all right at the end.
        # label_path = self._dirs.label_dir.chunk_path(self.index, '{:d}.txt')
        # with open(label_path, 'w') as f:
        #     f.write(label)

    @property
    def index(self):
        return self.config['index']

    def _generate_spectrogram(self, samples):
        spectrogram = compute_ac_spectrogram(samples)
        spectrogram = linearise_ac_spectrogram(spectrogram)
        spectrogram = spectrogram / np.max(spectrogram)  # [0, 1]
        spectrogram = self._noisify_spectrogram(spectrogram)
        spectrogram = np.asarray(255 * spectrogram / np.max(spectrogram),
                                 dtype=np.uint8)
        return spectrogram

    @staticmethod
    def _noisify_spectrogram(spectrogram):
        noise = np.random.normal(loc=0,
                                 scale=ff_config.CNN_NOISIFY_SCALE_,
                                 size=spectrogram.size
                                 ).reshape(spectrogram.shape)
        noise[noise < 0] = 0  # Because autocorrelation step does this too
        return spectrogram + noise

    @staticmethod
    def _denoise_spectrogram(spectrogram, spec_mask, salt=True):
        """Apply the computed mask to the computed spectrogram"""
        spectrogram = data_ops.spec_to_pseudo(spectrogram)
        spec_mask = np.asarray(spec_mask[:spectrogram.shape[0]], np.bool)

        if salt:
            # Salting means we're not training the RNN on perfectly denoised
            #   images. This reflects the fact that the output of the CNN
            #   won't always be perfect.
            salt = np.random.uniform(size=spectrogram.size
                                     ).reshape(spectrogram.shape)
            salt[salt < ff_config.RNN_INPUT_SALTING_] = 1
            salt[salt < 1] = 0
            spec_mask = np.logical_or(salt, spec_mask)

        denoised = spectrogram * spec_mask
        denoised /= np.max(denoised)
        denoised *= 255
        denoised = np.asarray(denoised, dtype=np.uint8)
        return denoised


class ConfigError(Exception):
    """Raised to fail the creation of a dataset entry."""
