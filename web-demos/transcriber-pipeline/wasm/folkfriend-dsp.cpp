#include <emscripten.h>
#include <math.h>

extern "C"
EMSCRIPTEN_KEEPALIVE
void processFreqData(float *data) {

    // MUST be FFConfig.SPEC_FRAME_SIZE / 2.
    //  Hardcode it here for simplicity.
    int size = 512;

    for(int i = 0; i < size; i++) {
        data[i] = 1 + pow(data[i], 2);
    }
}

// Surma has these functions at
//  https://gist.github.com/surma/d04cd0fd896610575126d30de36d7eb6
//  https://developers.google.com/web/updates/2018/08/embind (not using embind though)

extern "C"
EMSCRIPTEN_KEEPALIVE
int mallocWrapper(int size) {
    return (int)malloc(size);
}

extern "C"
EMSCRIPTEN_KEEPALIVE
void freeWrapper(int p) {
  free((void *)p);
}