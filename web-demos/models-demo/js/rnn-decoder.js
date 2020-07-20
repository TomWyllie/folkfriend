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
        let rnnInput = t.expandDims().transpose().expandDims();
        console.warn("RNN Input shape", rnnInput.shape);
        const prediction = this.model.predict(rnnInput);
        console.debug(prediction);

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
        let lastWas55 = false;
        for(let i = 0; i < decodedBins.length; i++) {
            if(decodedBins[i] === 55) {
                lastWas55 = true;
            } else {
                if(lastWas55) {
                    greedyDecode.push(FFConfig.MIDI_MAP[decodedBins[i]]);
                }
                lastWas55 = false;
            }
        }

        console.debug(greedyDecode);
        return greedyDecode.join('');
    }
}
