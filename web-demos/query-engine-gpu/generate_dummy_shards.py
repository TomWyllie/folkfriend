import numpy as np
import imageio

a = np.arange(64, dtype=np.uint8)
a = np.tile(4 * a, 4).reshape(2, 128)
print(a)

imageio.imwrite('dummy_shards.png', a)


# Useful for debugging, Cooley's reel noet given  as

[92,  84,  92,  84,  76, 104,  92,  92,  92,  96,
       104, 112, 120, 124, 104,  92,  92,  92,  92,  84,  92,  84,  76,
       112,  84,  84, 104,  92,  76,  84,  84, 112, 104,  92,  92,  92,
        92,  84,  92,  84,  76, 104,  92,  92,  92,  96, 104, 112, 120,
       124, 104,  92,  92,  92,  92,  84,  92]