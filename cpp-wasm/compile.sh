red=$'\e[1;31m'
grn=$'\e[1;32m'
yel=$'\e[1;33m'
blu=$'\e[1;34m'
mag=$'\e[1;35m'
cyn=$'\e[1;36m'
end=$'\e[0m'

printf "\n${yel}Checking emscripten version:\n${end}${cyn}"
emcc --version
printf "\n${yel}Compiling FolkFriend's C++ functions into WebAssembly using emscripten\n${end}$"

mkdir -p build
cd build
emcmake cmake ..
make
cd ..

if [[ -f "build/ff-wasm.js" && -f "build/ff-wasm.wasm" ]]
then
  printf "\n${grn}Finished compiling to WebAssembly\n${end}"
else
  printf "\n${red}Could not compile to WebAssembly\n${end}"
  exit
fi

printf "\n${grn}Copying built files to app directory\n${end}"
cp -v build/ff-wasm.js ../ff-pwa/src/folkfriend/
cp -v build/ff-wasm.wasm ../ff-pwa/src/folkfriend/

printf "\n${grn}Copying files to run demo\n${end}"
cp -v build/ff-wasm.js demo/
cp -v build/ff-wasm.wasm demo/
cp -v ../ff-pwa/src/folkfriend/ff-cnn.js demo/
cp -v ../ff-pwa/src/folkfriend/ff-config.js demo/
cp -v ../ff-pwa/src/folkfriend/ff-dsp.js demo/
cp -v ../ff-pwa/public/audio/fiddle.wav demo/
mkdir -p demo/tf/model/
rm -f demo/tf/model/*
cp -vr ../ff-pwa/public/tf/model/* demo/tf/model/
