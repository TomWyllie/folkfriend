"use strict";

import CNNDenoiser from "./cnn-denoiser.js";
import * as FFConfig from "./ff-config.js"

function main() {
    const denoiser = new CNNDenoiser()

    const CNNFileInput = document.querySelector('#cnn-file-input');
    const CNNImgInput = document.querySelector('#cnn-img-input');
    const CNNStartButton = document.querySelector('#cnn-start-button')

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
        const denoisedOutput = denoiser.addBulkToQueue(CNNImgInput);
    });
}

window.onload = main;