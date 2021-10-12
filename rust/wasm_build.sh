# Compile
wasm-pack build --target web --release

# Aggressively optimise for speed
#wasm-opt -O3 -o pkg/folkfriend_bg.wasm pkg/folkfriend_bg.wasm 

# Move to app
cp pkg/* ../app/public/wasm/
