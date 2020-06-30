function main() {
    loadModel().then()
}

async function loadModel() {
    const model = await tf.loadLayersModel('/ff_cnn_tfjs/model.json');
    console.debug(model);

    // TODO load in image
    // const prediction = model.predict(example);
}

window.onload = main;