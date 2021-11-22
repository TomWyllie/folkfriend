use crate::feature::signal::hertz_to_midi;
use crate::feature::types::InterpInds;
use crate::ff_config;

#[derive(Debug)]
pub struct InterpInd {
    pub lo_weight: f32,
    pub hi_weight: f32,
    pub hi_index: usize,
}

pub fn compute_interp_inds(valid_sample_rate: &u32) -> InterpInds {
    let half_window: usize = ff_config::SPEC_WINDOW_SIZE / 2;

    // We will have a buffer that contains 1 + SPEC_WINDOW_SIZE / 2 unique
    //  frequencies, which are sample_rate / n where n goes from 0 to
    //  SPEC_WINDOW_SIZE / 2. The values correspond to autocorrelation
    //  indices [0, 1, ..., N-1, -N, -N+1, -N+2, ..., -2, -1].
    //                     |_______|
    //               Note what happens here
    //
    // i.e. index 0 is the DC bin, leaving an odd number of elements remaining
    //  which are symmetric about bin 512, i.e.
    //  bins (1:511) inclusive = reverse(513:1023) inclusive.
    // That's 511 values, plus DC and plus bin 512 gives 513 unique values.

    let mut ac_bin_midis: Vec<f32> = Vec::new();

    for ac_bin in 1..half_window + 1 {
        let ac_freq = *valid_sample_rate as f32 / ac_bin as f32;
        let ac_midi = hertz_to_midi(&ac_freq);
        ac_bin_midis.push(ac_midi);
    }
    // 0th bin is highest
    if ac_bin_midis[0] < ff_config::MIDI_HIGH as f32
        || ac_bin_midis[half_window - 1] > ff_config::MIDI_LOW as f32
    {
        // TODO better behaviour than just panicking.
        panic!("Spectrogram range is insufficient. Has an invalid sample rate been used?");
    }

    let mut interp_indices: InterpInds = Vec::new();

    // Compute lowest MIDI value.
    //  e.g. if lowest MIDI note is 48 and SPEC_BINS_PER_MIDI is 3 then the
    //  MIDI values we calculate are [47.666, 48.0, 48.333, ..., ].
    //  These calculated MIDI values are then binned into one feature per note.
    let edge =
        (ff_config::SPEC_BINS_PER_MIDI as f32 / 2.).floor() / ff_config::SPEC_BINS_PER_MIDI as f32;
    let lo_midi = ff_config::MIDI_LOW as f32 - edge;
    let spec_bin_width = 1. / ff_config::SPEC_BINS_PER_MIDI as f32;

    for spec_bin in 0..ff_config::SPEC_BINS_NUM {
        let spec_bin_midi = lo_midi + spec_bin as f32 * spec_bin_width;

        // Each feature bin is a linear combination of two bins from
        // the spectrogram.
        // Note both arrays are monotonically decreasing in value
        let mut hi = 1;
        for (i, ac_bin_midi) in ac_bin_midis[1..half_window].iter().enumerate() {
            if spec_bin_midi > *ac_bin_midi {
                hi = 1 + i;
                break;
            }
        }
        // 'hi' => High index => Low frequency
        let delta: f32 = ac_bin_midis[hi - 1] - ac_bin_midis[hi];
        let w1: f32 = (ac_bin_midis[hi - 1] - spec_bin_midi) / delta;
        let w2: f32 = -(ac_bin_midis[hi] - spec_bin_midi) / delta;
        if w1 > 1. || w1 < 0. || w2 > 1. || w2 < 0. {
            panic!("Invalid x1: {}, x2: {}", w1, w2);
        }

        interp_indices.push(InterpInd {
            hi_weight: w1,
            lo_weight: w2,

            // The plus one here is because we excluded the DC bin from ac_bin_midis
            //  (as it's MIDI value is infinity)
            hi_index: hi + 1,
        })
    }

    return interp_indices;
}
