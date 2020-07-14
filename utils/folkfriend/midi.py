import csv
import math

import numpy as np
from folkfriend import ff_config


class CSVMidiNoteReader(csv.DictReader):
    def __init__(self, *posargs, **kwargs):
        kwargs['fieldnames'] = ['track', 'time', 'type', 'channel',
                                'note', 'velocity']
        super().__init__(*posargs, **kwargs)

    def to_pseudo_spectrogram(self, tempo, start_seconds, end_seconds=10):
        sample_duration = (end_seconds - start_seconds)
        num_frames = ((ff_config.SAMPLE_RATE * sample_duration
                       ) // ff_config.SPECTROGRAM_HOP_SIZE) - 1
        num_bins = ff_config.NUM_BINS

        # Length in seconds of one frame
        frame_length = ff_config.SPECTROGRAM_HOP_SIZE / ff_config.SAMPLE_RATE

        # Times in seconds of frames, after the start point
        frame_times_s = frame_length * np.arange(num_frames)

        # Times in seconds of frames thresholds, after the start point.
        #   There's an extra half here for centering.
        frame_times_s += frame_length / 2

        # Add start offset
        frame_times_s += start_seconds

        # Convert to milliseconds
        frame_times_ms = 1000 * frame_times_s

        active_notes = {}
        us_per_crotchet = 60000000 / tempo

        # This 480,000 comes from 125 bpm being the default tempo with the hard
        #   coded midi times (240ms = 1 quaver => 480000us = 1 crotchet)
        ms_scale_factor = us_per_crotchet / 480000

        pseudo_spectrogram = np.zeros((num_frames, num_bins), dtype=np.uint8)

        for record in self:
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
                if note_end < 1000 * start_seconds:
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

        return pseudo_spectrogram

    def to_note_contour(self, tempo, start_seconds, end_seconds=10):
        label = ''

        for record in self:
            raise NotImplementedError()

        return label
