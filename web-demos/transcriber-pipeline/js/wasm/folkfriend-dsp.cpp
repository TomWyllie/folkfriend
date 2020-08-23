#include <emscripten.h>
#include <math.h>
#include "ffft/src/FFTRealFixLen.h"

// 1024-point (2^10) FFT object constructed.
ffft::FFTRealFixLen <10> fftObj;

// Corresponds to k = 1/3. See processFreqData().
float powBase = cbrt(10.0);

// MUST be
//  FFConfig.SPEC_WINDOW_SIZE / 2.
//  and FFConfig.SPEC_WINDOW_SIZE.
//  Hardcode it here for simplicity.
int hsize = 512;
int size = 1024;

float concatFreqData[1024] = {};
float autocorrComplexData[1024] = {};

extern "C"
EMSCRIPTEN_KEEPALIVE
void processFreqData(float *data) {

    // First perform the rescaling operation.

    // Decimal -> Decibel conversion is 20 * log10(x)
    // So we want to do 10^(x/20)
    // But remember we are using a "k" value (see ff_config.py) of 1/6.
    // So we want to do:
    //      (10^(x/20))^(1/3)
    // Which is equal to
    //      cbrt(10)^(x/20)

    // Aside:
    //  We use cube root even though our k value is 1/6. Because The k value
    //  is defined relative to Re^2 + Im^2 whereas the web audio spec gives
    //  getFloatFrequencyData values as |X[k]| ie sqrt(Re^2 + Im^2). That is,
    //  a power of a half is already accounted for. Therefore we only need
    //  to 'power down' by another factor of a third to take us to 1/6.

    for(int i = 0; i < 512; i++) {
        data[i] = pow(powBase, data[i]);
    }

    // getFloatFrequencyData returns only the left side of the symmetric
    //  FFT spectrum. We know it's symmetric because audio data samples
    //  can only be real. But we need a 1024-length input vector for
    //  the second FFT.
    for(int i = 0; i < hsize; i++) {
        concatFreqData[i] = data[i];
    }

    // Mirror image for second half of spectrum
    for(int i = hsize; i < size; i++) {
        concatFreqData[i] = data[size - i - 1];
    }

    // Set middle value. TODO Need to verify if this is actually correct.
    //  It appears as though web FFT implementation returns one fewer
    //  piece of information than scipy (but this probably isn't the case).
    //  (it doesn't make much difference as it's such a high frequency anyway)
    concatFreqData[hsize] = data[hsize - 1];

    // Now carry out the second FFT.
    fftObj.do_fft(concatFreqData, autocorrComplexData);

    for(int i = 0; i < hsize; i++) {
        // Copy result back to buffer exposed to javascript to view results
        // NOTE from the structuring of the FFT library all the real elements
        //  are before all the imaginary elements. We never access the
        //  imaginary part of the array (second half), as we're only
        //  interested in the real part.
        data[i] = autocorrComplexData[i];
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