from folkfriend import ff_config

base_scores = {
    -12: -2.639916731,
    -11: -4.394149488,
    -10: -2.972304221,
    -9: -2.166698359,
    -8: -2.306580069,
    -7: -1.162611053,
    -6: -3.731280049,
    -5: -0.6308846752,
    -4: -0.6756249503,
    -3: -0.3947562571,
    -2: -0.2396100196,
    -1: -1.375965628,
    1: -1.300531153,
    2: 0,
    3: -0.3356148385,
    4: -0.59683188,
    5: -0.3042728195,
    6: -3.049916994,
    7: -1.22192358,
    8: -2.487884978,
    9: -2.772818809,
    10: -3.572246443,
    11: -5.149161163,
    12: -3.41406825
}

weight = 0.1

def score_pitch_interval(interval):
    if interval == 0:
        raise RuntimeError('Cannot score interval of zero.')

    return -ff_config.PITCH_MODEL_WEIGHT * base_scores.get(interval, -20)
