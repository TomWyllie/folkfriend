from folkfriend import ff_config

# 512 samples per frame / 48000 samples per second
#   = 0.0107 seconds per frame  (93.75 frames per second)
frame_period_seconds = ff_config.SPEC_HOP_SIZE / ff_config.SAMPLE_RATE

# Assume a standard 4/4 reel with 8 quavers (eighth notes) per bar.
#   If a quaver is N frames, then a crotchet is 2 * N frames.
#   A crotchet then lasts for (2 * N * frame_period_seconds) seconds.
#   The crotchet BPM is then 60 / (2 * N * frame_period_seconds)
#                          = 30 / (N * frame_period_seconds)
for n in [*range(1, 30), *range(32, 60, 4)]:
    print('If a quaver lasts {:d} frames then crotchet bpm is {:.2f}'.format(
        n, 30 / (n * frame_period_seconds)
    ))
