function main() {
    loadCNN().then()
    loadRNN().then()
}

async function loadCNN() {
    const model = await tf.loadLayersModel('/cnn/model.json');
    console.info(model);

    // TODO load in image
    // const prediction = model.predict(example);
}

async function loadRNN() {
    const model = await tf.loadLayersModel('/rnn/model.json');
    console.info(model);

    // TODO load in image
    // const prediction = model.predict(example);
}

window.onload = main;