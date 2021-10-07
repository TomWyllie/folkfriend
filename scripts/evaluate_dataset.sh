if [ $# -eq 0 ]; then
    echo "Please provide a path to a dataset"
    exit 1
fi

echo "Evaluating dataset $1"

SLICES="$1/slices.csv"
RECORDINGS="$1/recordings.csv"

if [[ ! -f "$SLICES" ]];
then
    echo "Could not find '$SLICES', aborting."
    exit
fi

if [[ ! -f "$RECORDINGS" ]];
then
    echo "Could not find '$RECORDINGS', aborting."
    exit
fi

folkfriend query $SLICES > queries.csv
python compute_rankings.py queries.csv $RECORDINGS > rankings.csv
python analyse_rankings.py rankings.csv
