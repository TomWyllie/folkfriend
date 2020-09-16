import numpy as np
import matplotlib.pyplot as plt

RESOLUTION = 34
SAMPLING = 12


def main():
    # Radii are 3, 4, 5

    # relevant angles 45 20 36
    #   34 looks right and is (45 - 20) + (45 - 36)
    gear1 = gear(6, 32 * np.pi / 180)

    gear2 = gear(10)

    # relevant angles 45 22.5 36
    #   31.5 looks right and is (45 - 22.5) + (45 - 36)
    gear3 = gear(8, 35 * np.pi / 180)

    # r1 + r2 + 2 * (half tooth height) / sqrt(2)
    # sqrt(2) because 45 degrees
    d12 = 9 / (2 ** 0.5)
    d23 = 10 / (2 ** 0.5)

    # Add some spacing so they don't touch tangentially
    d12 += 0.20
    d23 += 0.20

    # d12 = d23 = 0

    g2x, g2y = -4.0, -1.0
    g1_centre = (g2x + d12, g2y - d12)
    g2_centre = (g2x, g2y)
    g3_centre = (g2x + d23, g2y + d23)

    # p1 = cartesian_to_svg_path(*gear1)
    # p2 = cartesian_to_svg_path(*gear2)
    # p3 = cartesian_to_svg_path(*gear3)

    p1 = cartesian_to_svg_path_linear(*gear1)
    p2 = cartesian_to_svg_path_linear(*gear2)
    p3 = cartesian_to_svg_path_linear(*gear3)

    with open('gears_template.html') as f:
        svg = f.read()

    svg = svg.replace('[GEAR_1_PATH]', p1)
    svg = svg.replace('[GEAR_2_PATH]', p2)
    svg = svg.replace('[GEAR_3_PATH]', p3)

    for value, tag in zip(
            [*g1_centre, *g2_centre, *g3_centre],
            ['[G1X]', '[G1Y]', '[G2X]', '[G2Y]', '[G3X]', '[G3Y]', ]
    ):
        svg = svg.replace(tag, str(int(RESOLUTION * value)))

    with open('gears.html', 'w') as f:
        f.write(svg)


def logistic(n):
    a = 0.1 / (n / 8.0) ** 0.8
    w = 1.0

    x = np.linspace(-w, w, SAMPLING)
    z = np.exp(-x / a)
    y = z / (1 + z)

    # plt.plot(x, y)
    # plt.show()

    return y


def gear(n_teeth, rot=0):
    # Width of teeth must be the same.
    #   Each tooth will occupy 2*pi*r / n_teeth of a slice of the diameter.
    #   Therefore to mesh r / n_teeth must be constant
    tooth_size = 0.5
    radius = tooth_size * n_teeth

    lg = logistic(n_teeth)
    tooth = np.concatenate((lg, lg[::-1]))

    # plt.plot(tooth)
    # plt.show()

    teeth = np.tile(tooth, n_teeth)
    teeth += radius

    theta = np.linspace(0, 2 * np.pi, teeth.size, endpoint=False)
    theta += rot

    x, y = polar_to_cartesian(teeth, theta)
    return x, y


# noinspection PyPep8Naming
# def cartesian_to_svg_path(X, Y):
#     #  q dx1 dy1, dx dy
#     n = X.size
#     offset = 10
#     assert offset < n
#     X = np.array(RESOLUTION * X, np.int16)
#     Y = np.array(RESOLUTION * Y, np.int16)
#
#     X = np.tile(X, 2)
#     Y = np.tile(Y, 2)
#     x = X[1:] - X[:-1]
#     y = Y[1:] - Y[:-1]
#
#     d = [f'M {X[offset]} {Y[offset]} ']
#     # d = [f'M 0 0 ']
#
#     cx1, cx2 = compute_control_points(X)
#     cy1, cy2 = compute_control_points(Y)
#
#     cx1 -= X[:-1]
#     cx2 -= X[:-1]
#     cy1 -= Y[:-1]
#     cy2 -= Y[:-1]
#
#     print(cx1)
#     print(cx2)
#
#     # Add an arbitrary offset of 10 to move away from edge effects
#     for i in range(offset, offset + n):
#         d.append(f'c {cx1[i]} {cy1[i]} {cx2[i]} {cy2[i]} {x[i]} {y[i]}')
#
#     d.append(' z')
#
#     return ''.join(d)


# noinspection PyPep8Naming
def cartesian_to_svg_path_linear(X, Y):
    X = np.array(RESOLUTION * X, np.float32)
    Y = np.array(RESOLUTION * Y, np.float32)
    x = X[1:] - X[:-1]
    y = Y[1:] - Y[:-1]

    d = [f'M {X[0]} {Y[0]} ']

    # Add an arbitrary offset of 10 to move away from edge effects
    for dx, dy in zip(x, y):
        d.append('l {:.2f} {:.2f}'.format(dx, dy))
    d.append(' z')

    return ''.join(d)


# https://www.particleincell.com/wp-content/uploads/2012/06/bezier-spline.js
# computes control points given knots K, this is the brain of the operation
def compute_control_points(k):
    n = len(k) - 1
    p1 = [0] * n
    p2 = [0] * n

    # RHS Vector
    a = [0] * n
    b = [0] * n
    c = [0] * n
    r = [0] * n

    # Left most segment
    a[0] = 0
    b[0] = 2
    c[0] = 1
    r[0] = k[0] + 2 * k[1]

    # Internal segments
    for i in range(n - 1):
        a[i] = 1
        b[i] = 4
        c[i] = 1
        r[i] = 4 * k[i] + 2 * k[i + 1]

    # Right Segment
    a[n - 1] = 2
    b[n - 1] = 7
    c[n - 1] = 0
    r[n - 1] = 8 * k[n - 1] + k[n]

    # Solves Ax = b with the Thomas algorithm (from Wikipedia)
    for i in range(n):
        m = a[i] / b[i - 1]
        b[i] = b[i] - m * c[i - 1]
        r[i] = r[i] - m * r[i - 1]

    p1[n - 1] = r[n - 1] / b[n - 1]
    for i in range(n - 2, 0, -1):
        p1[i] = (r[i] - c[i] * p1[i + 1]) / b[i]

    # We have p1, now compute p2
    for i in range(n - 1):
        p2[i] = 2 * k[i + 1] - p1[i + 1]
        p2[n - 1] = 0.5 * (k[n] + p1[n - 1])

    # return np.asarray(p1, dtype=np.int16), np.asarray(p2, dtype=np.int16)
    return np.asarray(p1, dtype=np.float32), np.asarray(p2, dtype=np.float32)


def polar_to_cartesian(r, theta):
    x = r * np.cos(theta)
    y = r * np.sin(theta)
    return x, y


if __name__ == '__main__':
    main()
