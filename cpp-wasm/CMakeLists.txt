cmake_minimum_required(VERSION 3.10)

project(ff-wasm)
add_subdirectory(/home/tom/repos/folkfriend/cpp-wasm/wasm-dependencies-folkfriend/kissfft)
add_executable(ff-wasm folkfriend-dsp.cpp)

# IMPORTANT NOTE!
#   When compiling I had to change the line from
#   add_library(kissfft kiss_fft.c)
#   to
#   add_library(kissfft kiss_fft.c tools/kiss_fftr.c)
#   in the kissfft repository's CMakeLists.txt to enable
#   real FFTs.
target_link_libraries(ff-wasm PUBLIC kissfft)

# (emscripten only)
# Be sure to use -O3 or -Os for production not -O0 !!
set_target_properties(ff-wasm PROPERTIES LINK_FLAGS "\
		-O3\
		-s ALLOW_MEMORY_GROWTH=1\
		-s DISABLE_EXCEPTION_CATCHING=0\
		-s ENVIRONMENT=worker\
		-s EXPORT_NAME='loadDSPWasmModule'\
		-s EXPORTED_FUNCTIONS='[_main, _processFreqData, _updateResamplingCoefficients, _getLastDCComponent, _mallocWrapper, _freeWrapper]'\
		-s EXTRA_EXPORTED_RUNTIME_METHODS='[cwrap]'\
		-s MODULARIZE=1 \
		-s WASM=1")
