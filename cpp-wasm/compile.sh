mkdir -p build
cd build
emcmake cmake ..
make

cd ..
cp -v build/ff-wasm.js demo/
cp -v build/ff-wasm.wasm demo/
