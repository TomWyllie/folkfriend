../rust/target/release/folkfriend query ~/datasets/folkfriend-evaluation-dataset/slices.csv > dataset_queries.csv
python compute_rankings.py dataset_queries.csv ~/datasets/folkfriend-evaluation-dataset/recordings.csv > rankings.csv
python analyse_rankings.py rankings.csv
