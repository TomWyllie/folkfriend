import math

import matplotlib.pyplot as plt
import numpy as np

from folkfriend import ff_config

def score_note_length(length, length_scale):
    """Score the likelihood of a note being a given length"""

    # 'dimensionless' length scaling, i.e. relative to the tempo.
    length /= length_scale

    # The optimal score partitions into N notes, where N is one of these two
    #   bounds. 
    n_lo = int(length)
    n_hi = n_lo + 1

    n_hi_score = n_hi * abs(math.log(length / n_hi))
    
    if n_lo > 0:
        n_lo_score = n_lo * abs(math.log(length / n_lo))
        score = min(n_lo_score, n_hi_score)
    else:
        score = n_hi_score

    return ff_config.TEMPO_MODEL_WEIGHT * score


if __name__ == '__main__':
    scaled_lengths = np.linspace(0.1, 10, num=1000)
    costs = []

    plt.style.use('ggplot')

    # True cost is the minimum of all of these (to infinity).
    #   Except we don't have to worry about infinites because
    #   the optimal cost for A <= X <= B is always between
    #   A and B. e.g. if the scaled length is 6.5 then we need
    #   only try partitioning into 6 and 7, because the optimal
    #   will be one of those two. As N -> inf, the shape of this
    #   function tends to a sawtooth wave, but we don't use this
    #   as an approximation because the log shape for <1 (left side)
    #   is very important.

    for i in range(1, 8):
        cost = np.abs(i * np.log(scaled_lengths / i))
        plt.plot(scaled_lengths, cost, label=str(i))

    plt.legend()
    plt.show()
