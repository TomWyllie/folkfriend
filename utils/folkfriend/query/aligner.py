import numpy as np

match_score = 2
mismatch_score = -2
gap_score = -1

def needleman_wunsch_fast(A, B):
    # Memory-efficient version of Needleman-Wunsch written for Python.
    #   ~ Tom Wyllie 2021

    # print(A)
    # print(B)
    # exit()

    if len(A) == 0 or len(B) == 0:
        return 0.

    if len(A) > len(B):
        temp = A
        A = B
        B = temp

    # last_row = np.zeros(len(A) + 1, dtype=np.int16)
    # last_row.fill(0)
    last_row = [0] * (len(A) + 1)

    #      A1 A2 A3 .. AN
    #   B1
    #   B2
    #   B3
    #   ..
    #   BN

    prev_diag = 0
    curr_diag = 0

    # Populate dynamic programming lattice
    for row in range(len(B)):
        prev_diag = 0
        for col in range(1, len(last_row)):
            curr_diag = prev_diag
            prev_diag = last_row[col]

            # We store the previous row in this buffer and work along it,
            #   updating it to 'this' row. This is for efficiency.
            last_row[col] = max(
                curr_diag + (match_score if A[col - 1] == B[row] else mismatch_score),
                last_row[col - 1] + gap_score,
                last_row[col] + gap_score)

        last_row[-1] = max(last_row[-1], prev_diag)

    # Raw score
    # return max(last_row)

    # Normalised [0, 1].
    return 0.5 * max(last_row) / min(len(A), len(B))

if __name__ == '__main__':
    print(needleman_wunsch_fast('hello', 'hello'))          # 1.0
    print(needleman_wunsch_fast('hello', 'hello world'))    # 1.0
    print(needleman_wunsch_fast('hello', 'hallo'))  # 0.6 (-2 for mismatch, +8)
    print(needleman_wunsch_fast('hello', 'yello'))  # 0.7 (-1 for edge gap, +8)
