import * as FFConfig from "./ff-config.js"

// TODO add another pipeline node which just does this reshaping

export default class CNNDenoiser {
    constructor() {
        // TODO block new queries until previous queue is finished (with option to cancel)
        this.queue = [];
        this.outQueue = [];
        this.model = () => {console.error("Model not yet loaded.")};
        this.loadModel();
    }

    loadModel(){
        tf.loadLayersModel('/rnn/model.json')
            .then(m => {
                this.model = m;
            })
            .catch((e) => {console.error(e)});
    }

    predict(t) {
        console.warn("RNN Predict in shape", t.shape);
        // let rnnInput = t.expandDims().transpose().expandDims();
        let rnnInput = t.expandDims();
        console.warn("RNN Input shape", rnnInput.shape);
        let prediction = this.model.predict(rnnInput);
        console.debug(prediction);

        tf.max(prediction).print();
        tf.min(prediction).print();

        prediction = tf.sub(prediction, tf.min(prediction));
        prediction = tf.div(prediction, tf.max(prediction));

        // prediction = prediction.softmax();

        tf.max(prediction).print();
        tf.min(prediction).print();

        this.prediction = prediction;

        return this.decodePrediction(prediction);
    }

    decodePrediction(prediction) {
        let argMaxes = tf.argMax(prediction, 2).squeeze();
        console.debug(argMaxes);

        // synchronous blocking here is not good.
        //  use .data() async in future
        let decodedBins = argMaxes.dataSync();
        console.debug(decodedBins);

        let greedyDecode = [];
        let lastWasBlank = (decodedBins[0] !== 48);
        for(let i = 0; i < decodedBins.length; i++) {
            if(decodedBins[i] === 48) {
                lastWasBlank = true;
            } else {
                if(lastWasBlank) {
                    greedyDecode.push(FFConfig.MIDI_MAP[decodedBins[i]]);
                }
                lastWasBlank = false;
            }
        }

        console.debug(greedyDecode);
        return greedyDecode.join('');
    }
}
