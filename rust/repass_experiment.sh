SLICES="/home/tom/datasets/folkfriend-evaluation-dataset/slices.csv"

declare -a arr=("1" "5000" "2000" "1000" "500" "350" "200" "100" "50" "15" "5")

## now loop through the above array
for i in "${arr[@]}"
do
    cp "exp_configs/ff_config.$i.rs" "src/ff_config.rs"
    ./binary_build.sh
    folkfriend query $SLICES > "queries.$i.csv"
done
