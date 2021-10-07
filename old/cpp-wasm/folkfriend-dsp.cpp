#include <cmath>
#include "tools/kiss_fftr.h"
#include <iostream>

// MUST be
//  FFConfig.SPEC_WINDOW_SIZE / 2.
//  and FFConfig.SPEC_WINDOW_SIZE.
//  Hardcode it here for simplicity.
int specWindowSizeH = 512;
int specWindowSize = 1024;

int numResampledBins = 144;
int *loIndices;
int *hiIndices;
float *loWeights;
float *hiWeights;

// FFT variables
float hann[1024] = {};
float powerSpectrum[1024] = {};
kiss_fft_cpx firstFFT[512] = {};
kiss_fft_cpx secondFFT[512] = {};

float lastDCComponent = 0.0;

extern "C"
void processFreqData(float *data) {
    // First compute the cube-root power spectrum, then take another FFT to get
    //  the cepstrum and keep the positive real values.
    //  IE the following steps in python:
    //    signal = (signal_windowed * np.hann(window_size))
    //    spectra = np.fft.fft(signal)
    //    spectrogram = np.cbrt(np.abs(spectra))
    //    spectrogram = np.fft.rfft(spectrogram).real

    // Windowing
    for(int i = 0; i < specWindowSize; i++) {
        data[i] *= hann[i];
    }

    // FFT
    kiss_fftr_cfg cfg1 = kiss_fftr_alloc(specWindowSize, 0, NULL, NULL);
    kiss_fftr(cfg1, data, firstFFT);
    kiss_fftr_free(cfg1);

    // cbrt(abs(spectra))
    for(int i = 0; i < specWindowSizeH; i++) {
        float binPower = std::cbrt(std::hypot(firstFFT[i].r, firstFFT[i].i));
        // Mirror image. The spectrum is symmetric because the input is real.
        //  By copying the value here and using RFFT we save needlessly
        //  computing extra values as we already know it'll be the same on
        //  both sides (twice as fast to compute). But we need the whole
        //  spectrum for the next transform.

        //  Bin index 0 is only once (0 and 1024, but 1024 is modded to 0)
        //  So the spectrum goes [DC, A, B, C, ..., X, Y, Z, Y, X, ..., C, B, A]
        //                        0...1..2..3.............512...........1022..1024
        //  KissFFT correctly stores the extra "Z" element in index 512 and
        //      this entry isn't updated (because
        //      specWindowSize=1024 - i=511 = 513
        powerSpectrum[i] = binPower;
        powerSpectrum[(specWindowSize - i) % specWindowSize] = binPower;
    }

    // Un-cube-rooted
    lastDCComponent = std::hypot(firstFFT[0].r, firstFFT[0].i);

    // Now carry out the second FFT.
    kiss_fftr_cfg cfg2 = kiss_fftr_alloc(specWindowSize, 0, NULL, NULL);
    kiss_fftr(cfg2, powerSpectrum, secondFFT);
    kiss_fftr_free(cfg2);

    // Note we don't read every value in data[i], that is there are
    //  FFT bins discarded by this step. We don't care about very
    //  low or very high frequencies.
    for(int i = 0; i < numResampledBins; i++) {
        //  Resample data to be on a 'linear' scale (that is, musically
        //      linear ie ascending linearly through the MIDI notes).
        //  Copy result back to buffer exposed to javascript to view results
        data[i] = (
            secondFFT[loIndices[i]].r * loWeights[i] +
            secondFFT[hiIndices[i]].r * hiWeights[i]
        );
        data[i] = fmax(0.0, data[i]);
    }
}

extern "C"
void updateResamplingCoefficients(int *loIndicesNew,
                                  int *hiIndicesNew,
                                  float *loWeightsNew,
                                  float *hiWeightsNew) {
    loIndices = loIndicesNew;
    hiIndices = hiIndicesNew;
    loWeights = loWeightsNew;
    hiWeights = hiWeightsNew;
    std::cout << "WASM: Update resampling coefficients\n";
}

extern "C"
float getLastDCComponent() {
    return lastDCComponent;
}

void calcHann(int length) {
    std::cout << "WASM: Hann compute\n";
    for (int i = 0; i < length; i++) {
        hann[i] = 0.5 * (1 - cos(2*M_PI*i/(length - 1)));
    }
};

// Surma has these functions at
//  https://gist.github.com/surma/d04cd0fd896610575126d30de36d7eb6
//  https://developers.google.com/web/updates/2018/08/embind (not using embind though)
extern "C"
int mallocWrapper(int size) {
    return (uintptr_t)malloc(size);
}

extern "C"
void freeWrapper(uintptr_t p) {
  free((void *)p);
}

int main() {
    calcHann(1024);
}