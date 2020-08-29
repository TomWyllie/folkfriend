emcc --no-entry -s EXTRA_EXPORTED_RUNTIME_METHODS='["cwrap"]' -s ALLOW_MEMORY_GROWTH=1 -O3 folkfriend-dsp.cpp kissfft/*.c -s LLD_REPORT_UNDEFINED -o em.js

# We don't version-control the auto-generated em.js and em.wasm files, so 
#  they're included in web-demo/external/, so we copy them to there.
cp em.* ../external
