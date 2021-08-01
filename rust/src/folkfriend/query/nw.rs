use std::cmp;

const MATCH_SCORE: i32 = 2;
const MISMATCH_SCORE: i32 = -2;
const GAP_SCORE: i32 = -1;

pub fn needleman_wunsch(a: &String, b: &String) -> f64 {

    //  Memory-efficient version of Needleman-Wunsch written for Rust.
    //    ~ Tom Wyllie 2021

    if a.len() == 0 || b.len() == 0 {
        return 0.0;
    }

    // Swap a and b such that b always longer than a
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
                    curr_diag + (if a[col-1..col] == b[row..row+1] { MATCH_SCORE } else { MISMATCH_SCORE }),
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