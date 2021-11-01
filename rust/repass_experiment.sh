SLICES="/home/tom/datasets/folkfriend-evaluation-dataset/slices.csv"

# declare -a arr=("1" "2" "3" "4" "5" "6" "7" "8" "9" "10" "11", "12")
declare -a arr=("7" "8" "9" "10" "11" "12")

## now loop through the above array
for i in "${arr[@]}"
do
    cp "experiments/exp_configs/ff_config.$i.rs" "src/ff_config.rs"
    ./binary_build.sh
    folkfriend query $SLICES > "queries.$i.csv"
done
