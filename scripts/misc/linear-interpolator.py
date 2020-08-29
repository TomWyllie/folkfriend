"""Scipy has interp1d but there's no equivalent in tensorflow or JS.
We can carry out this operation though with simple linear combinations
    of the input vector and resample to the desired values. This is
    done in the folkfriend-dsp.cpp for maximum performance. The data
    arrays this generates should be copy and pasted into the cpp code,
    it's fine to hardcode this as it more or less never changes and
    creating this at runtime is relatively expensive.
"""

# This script is ported from the original javascript implementation
#   which is no longer part of folkfriend, hence why it's self-contained.

from folkfriend import ff_config
import numpy as np


def main():
    # Let LMB = FFConfig.LINEAR_MIDI_BINS.size
    # 
    # [<-- frame.size -->] [<-      LMB       ->]   /\
    #                      |                    |
    #                      |                    |  frame.size
    #                      |                    |
    #                      [                    ]   \/
    # 
    # Frame: 1x512            Interp: 512xLMB
    # 
    # Result: 1xLMB
    #
    # We don't actually do this as a matrix multiplication but do it
    #   sparsely for efficiency.

    print('Desired linear bins:', ff_config.LINEAR_MIDI_BINS_)
    lmb = len(ff_config.LINEAR_MIDI_BINS_)

    # Our frame will be half spectrogram window size at this stage
    bin_indices = np.arange(0, ff_config.SPEC_WINDOW_SIZE)

    # Zero frequency is never used but DC component = midi note[-infinity]
    #   which breaks following functions. Set it to the second lowest midi
    #   note (-20 or something around that value) as neither are used.
    bin_indices[0] = 1

    non_linear_bins = bins_to_midis(bin_indices)

    print('Original bins:', non_linear_bins)

    lo_indices = []
    lo_weights = []
    hi_indices = []
    hi_weights = []

    for i in range(lmb):
        # Each linear midi bin is a linear combination of two bins from
        #  the spectrogram
        linear_bin_midi_value = ff_config.LINEAR_MIDI_BINS_[i]

        if linear_bin_midi_value < non_linear_bins[len(non_linear_bins) - 2]:
            raise RuntimeError("Linear bin goes too low")

        # Note both arrays are monotonically decreasing in value
        lo = 0
        for j in range(len(non_linear_bins)):
            if linear_bin_midi_value > non_linear_bins[j]:
                lo = j
                break

        delta = non_linear_bins[lo - 1] - non_linear_bins[lo]
        x1 = (non_linear_bins[lo - 1] - linear_bin_midi_value) / delta
        x2 = -(non_linear_bins[lo] - linear_bin_midi_value) / delta

        if x1 > 1 or x1 < 0 or x2 > 1 or x2 < 0:
            raise RuntimeError(f'Invalid x1: {x1}, x2: {x2}')

        # Frequencies are decreasing so lower index => higher freq
        lo_indices.append(lo)
        lo_weights.append(x1)
        hi_indices.append(lo - 1)
        hi_weights.append(x2)

    return lo_indices, lo_weights, hi_indices, hi_weights


def bins_to_midis(indices):
    # Convert frequency bins into MIDI notes, according to equation
    # {midi notes relative to A4} = log_base[2^1/12](frequency / 440Hz)
    #  and                   freq = sampleRate / index
    # Which simplifies to midi note values of autocorrelation index =
    #  69 + log_base[2^1/12](index / 440)
    arr = ff_config.SAMPLE_RATE / (440.0 * indices)
    base = 2 ** (1. / 12.)
    return 69 + np.log(arr) / np.log(base)


if __name__ == '__main__':
    loi, low, hii, hiw = main()

    loi = r'{' + ', '.join(map(str, loi)) + r'}'
    hii = r'{' + ', '.join(map(str, hii)) + r'}'
    low = r'{' + ', '.join(map(lambda x: str(x.round(8)), low)) + r'}'
    hiw = r'{' + ', '.join(map(lambda x: str(x.round(8)), hiw)) + r'}'

    cpp = """
    int numResampledBins = {n};
    int loIndices[{n}] = {loi};
    float loWeights[{n}] = {low};
    int hiIndices[{n}] = {hii};
    float hiWeights[{n}] = {hiw};
    """.format(n=len(ff_config.LINEAR_MIDI_BINS_),
               loi=loi, low=low, hii=hii, hiw=hiw)
    print(cpp)
