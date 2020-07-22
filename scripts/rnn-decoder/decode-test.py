import imageio
import numpy as np
from folkfriend.rnn.dataset import Decoder

with open('/home/tom/datasets/folkfriend/table.txt', 'r') as f:
    inv_table = [char.strip() for char in f]

decoder = Decoder(inv_table)


p1 = imageio.imread('predictions-js.png')[:, :, 0:1].T
p1 = np.asarray(p1, dtype=np.float32)
print(p1.shape)
p1 = p1 / 255

p2 = imageio.imread('predictions-py.png').T
p2 = np.expand_dims(p2, 0)
print(p2.shape)
p2 = np.asarray(p2, dtype=np.float32)
p2 = p2 / 255

print(decoder.decode(p1, method='greedy'))
print(decoder.decode(p2, method='greedy'))
