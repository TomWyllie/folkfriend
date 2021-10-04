import numpy as np
import matplotlib.pyplot as plt

# note_shape = [0.4, 0.85, 1.0, 0.85, 0.4]
note_shape = [0.4, 0.6, 0.85, 1.0, 0.85, 0.6, 0.4]
note_filter = np.convolve(note_shape, note_shape, mode='full')

plt.subplot(1, 3, 1)
plt.plot(note_shape)

plt.subplot(1, 3, 2)
plt.plot(note_filter)

note_filter -= np.mean(note_filter)
plt.subplot(1, 3, 3)
plt.plot(note_filter)

plt.savefig('tempo.png')

print(list(note_filter))

# Approx of the above filter
pitch_filter = [-1.20, -0.68, 0.16, 1.01, 1.40, 1.01, 0.16, -0.68, -1.20]
print(sum(pitch_filter))