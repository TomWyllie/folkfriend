use std::cmp;

const MATCH_SCORE: i32 = 2;
const MISMATCH_SCORE: i32 = -2;
const GAP_SCORE: i32 = -1;

fn needleman_wunsch_fast(a: Vec<i32>, b: Vec<i32>) -> f64 {

    //  Memory-efficient version of Needleman-Wunsch written for Rust.
    //    ~ Tom Wyllie 2021

    if a.len() == 0 || b.len() == 0 {
        return 0.0;
    }

    // Swap a and b
    let (a, b) = if a.len() > b.len() { (&b, &a) } else { (&a, &b) };

    let mut last_row: Vec<i32> = vec![0; a.len() + 1];
    let last_col_index: usize = a.len();

    //       a1 a2 a3 .. aN
    //    b1
    //    b2
    //    b3
    //    ..
    //    bN

    let mut prev_diag: i32;
    let mut curr_diag: i32;

    //  Populate dynamic programming lattice
    for row in 0..b.len() {
        prev_diag = 0;
        for col in 1..last_row.len() {
            curr_diag = prev_diag;
            prev_diag = last_row[col];
    
            //  We store the previous row in this buffer and work along it,
            //    updating it to "this" row. This is for efficiency.
            last_row[col] = cmp::max(
                    curr_diag + (if a[col - 1] == b[row] { MATCH_SCORE } else { MISMATCH_SCORE }),
                    cmp::max(
                        last_row[col - 1] + GAP_SCORE, 
                        last_row[col] + GAP_SCORE
                    ));
        
            last_row[last_col_index] = cmp::max(last_row[last_col_index], prev_diag);
        }
    }

    //  Normalised [0, 1].
    let highscore: f64 = *last_row.iter().max().unwrap_or(&0) as f64;
    let norm_const: f64 = a.len() as f64;
    return 0.5 * highscore / norm_const;
}

fn main() {

    use std::time::Instant;
    let now = Instant::now();
    
    //  1.0
    println!("{}", needleman_wunsch_fast(
        [1, 2, 3, 4, 5].to_vec(), 
        [1, 2, 3, 4, 5].to_vec())
    );

    // 1.0
    println!("{}", needleman_wunsch_fast(
        [1, 2, 3, 4, 5].to_vec(),
        [1, 2, 3, 4, 5, 6, 6, 6].to_vec()
    ));

    //  0.6 (-2 for mismatch, +8)
    println!("{}", needleman_wunsch_fast(
        [1, 2, 3, 4, 5].to_vec(),
        [1, 2, 8, 4, 5].to_vec()
    ));
    
    //  0.7 (-1 for edge gap, +8)
    println!("{}", needleman_wunsch_fast(
        [1, 2, 3, 4, 5].to_vec(),
        [3, 2, 3, 4, 5].to_vec()
    ));

    // Benchmarking
    for _ in 0..1000 {
        needleman_wunsch_fast(
            [5, 0, 3, 7, 4, 9, 3, 6, 0, 0, 8, 6, 7, 9, 7, 10, 5, 10, 4, 9].to_vec(),
            [9, 1, 0, 7, 0, 7, 6, 4, 2, 3, 8, 4, 5, 8, 9, 5, 3, 10, 8, 7, 0, 8, 7, 6, 4, 10, 3, 8, 3, 3, 0, 3, 7, 0, 10, 3, 10, 8, 3, 4, 2, 9, 2, 3, 3, 6, 10, 5, 10, 3, 1, 7, 6, 7, 0, 7, 7, 5, 4, 0, 0, 3, 0, 10, 7, 2, 6, 5, 3, 0, 3, 5, 1, 10, 3, 1, 7, 2, 6, 7, 0, 5, 1, 3, 8, 8, 3, 10, 6, 0, 10, 7, 8, 2, 8, 3, 5, 0, 7, 4].to_vec()
        );
    }

    let elapsed = now.elapsed();
    println!("Elapsed: {:.2?}", elapsed);
}
