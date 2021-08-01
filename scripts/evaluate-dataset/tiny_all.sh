python label_slices.py --dataset ~/datasets/tiny-folkfriend-evaluation-dataset/
python transcribe_slices.py --dataset ~/datasets/tiny-folkfriend-evaluation-dataset/

cd /home/tom/repos/folkfriend/rust/target/release
./folkfriend dataset query ~/datasets/tiny-folkfriend-evaluation-dataset/
cd -
