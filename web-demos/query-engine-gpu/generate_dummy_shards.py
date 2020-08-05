import numpy as np
import imageio

a = np.arange(64, dtype=np.uint8)
a = np.tile(4 * a, 4).reshape(2, 128)
print(a)

imageio.imwrite('dummy_shards.png', a)
