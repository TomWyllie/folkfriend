import timeit

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
    # print(needleman_wunsch_fast('hello', 'hello'))          # 1.0
    # print(needleman_wunsch_fast('hello', 'hello world'))    # 1.0
    # print(needleman_wunsch_fast('hello', 'hallo'))  # 0.6 (-2 for mismatch, +8)
    # print(needleman_wunsch_fast('hello', 'yello'))  # 0.7 (-1 for edge gap, +8)


    #######################
    ### Rust Comparison ###
    #######################

    # Python time: ~ 900 ms
    # Rust time: ~ 10 ms

    now = timeit.default_timer()
    
    #   1.0
    print(needleman_wunsch_fast(
        [1, 2, 3, 4, 5], 
        [1, 2, 3, 4, 5])
    )

    #  1.0
    print(needleman_wunsch_fast(
        [1, 2, 3, 4, 5],
        [1, 2, 3, 4, 5, 6, 6, 6]
    ))

    #   0.6 (-2 for mismatch, +8)
    print(needleman_wunsch_fast(
        [1, 2, 3, 4, 5],
        [1, 2, 8, 4, 5]
    ))
    
    #   0.7 (-1 for edge gap, +8)
    print(needleman_wunsch_fast(
        [1, 2, 3, 4, 5],
        [3, 2, 3, 4, 5]
    ))

    #  Benchmarking
    for _ in range(0, 1000):
        needleman_wunsch_fast(
            [5, 0, 3, 7, 4, 9, 3, 6, 0, 0, 8, 6, 7, 9, 7, 10, 5, 10, 4, 9],
            [9, 1, 0, 7, 0, 7, 6, 4, 2, 3, 8, 4, 5, 8, 9, 5, 3, 10, 8, 7, 0, 8, 7, 6, 4, 10, 3, 8, 3, 3, 0, 3, 7, 0, 10, 3, 10, 8, 3, 4, 2, 9, 2, 3, 3, 6, 10, 5, 10, 3, 1, 7, 6, 7, 0, 7, 7, 5, 4, 0, 0, 3, 0, 10, 7, 2, 6, 5, 3, 0, 3, 5, 1, 10, 3, 1, 7, 2, 6, 7, 0, 5, 1, 3, 8, 8, 3, 10, 6, 0, 10, 7, 8, 2, 8, 3, 5, 0, 7, 4]
        )

    elapsed = timeit.default_timer() - now
    print(f'Elapsed: {elapsed} secs')
