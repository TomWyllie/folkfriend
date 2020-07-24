"use strict";

import CNNDenoiser from "./cnn-denoiser.js";
import RNNDecoder from "./rnn-decoder.js";
import * as FFConfig from "./ff-config.js"

function main() {
    // tf.setBackend('wasm');
    const denoiser = new CNNDenoiser()
    const decoder = new RNNDecoder()

    const CNNFileInput = document.querySelector('#cnn-file-input');
    const CNNImgInput = document.querySelector('#cnn-img-input');
    const CNNStartButton = document.querySelector('#cnn-start-button');
    const CNNCanvPrediction = document.querySelector('#cnn-canv-predict');
    const RNNCanvPrediction = document.querySelector('#rnn-canv-predict');
    const CNNCanvDenoised = document.querySelector('#cnn-canv-denoised');

    const CNNOutToRNNInButton = document.querySelector('#cnn-out-to-rnn-in');
    const RNNStartButton = document.querySelector('#rnn-start-button');
    const RNNCanvInput = document.querySelector('#rnn-canv-input');

    let cnnTensorOutput = 0;
    let rnnTensorInput = 0;

    CNNFileInput.addEventListener('change', function() {
        if (this.files && this.files[0]) {
            CNNImgInput.src = URL.createObjectURL(this.files[0]); // set src to blob url
            CNNImgInput.onload = () => {
                console.debug("Loaded image");
                CNNImgInput.classList.remove('Unloaded');
                CNNStartButton.removeAttribute('disabled');
            };
        }
    });

    CNNStartButton.addEventListener('click', function() {
        denoiser.addBulkToQueue(CNNImgInput);
        denoiser.dequeue();

        console.debug(denoiser.prediction);
        console.debug(denoiser.denoised);
        cnnTensorOutput = denoiser.denoised;
        CNNOutToRNNInButton.removeAttribute("disabled");

        tf.browser.toPixels(tf.cast(denoiser.prediction.transpose(), "float32"), CNNCanvPrediction).then(() => {
            CNNCanvPrediction.classList.remove('Unloaded');
        });

        tf.browser.toPixels(denoiser.denoised.transpose(), CNNCanvDenoised).then(() => {
            CNNCanvDenoised.classList.remove('Unloaded');
        });
    });

    CNNOutToRNNInButton.addEventListener('click', function() {
        console.debug(cnnTensorOutput.shape);
        // TODO cancel these two transposes
        rnnTensorInput = tf.reshape(cnnTensorOutput.transpose(),
            [cnnTensorOutput.shape[1] / 5, 5, cnnTensorOutput.shape[0]]);
        rnnTensorInput = tf.sum(rnnTensorInput, 1).transpose();
        rnnTensorInput = tf.cast(rnnTensorInput, "float32");
        rnnTensorInput = tf.div(rnnTensorInput, tf.max(rnnTensorInput));
        console.info("RNN tensor input", rnnTensorInput);
        tf.max(rnnTensorInput).print()
        tf.min(rnnTensorInput).print()
        // rnnTensorInput = tf.round(rnnTensorInput);
        // rnnTensorInput = tf.cast(rnnTensorInput, "int32");
        // rnnTensorInput = tf.cast(rnnTensorInput, "float32");
        // rnnTensorInput = tf.div(rnnTensorInput, tf.max(rnnTensorInput));

        RNNStartButton.removeAttribute("disabled");
        tf.browser.toPixels(rnnTensorInput.transpose(), RNNCanvInput).then(() => {
            RNNCanvInput.classList.remove('Unloaded');
        });
    });

    RNNStartButton.addEventListener('click', function() {
        // let rnnIn = tf.browser.fromPixels(RNNCanvInput, 1)
        let decoded = decoder.predict(rnnTensorInput);
        console.debug(decoded);
        document.querySelector("#decoded").innerText = decoded;

        tf.browser.toPixels(tf.cast(decoder.prediction.transpose(), "float32"), RNNCanvPrediction).then(() => {
            RNNCanvPrediction.classList.remove('Unloaded');
        });
    });
}

window.onload = main;