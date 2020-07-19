import * as FFConfig from "./ff-config.js"

export default class CNNDenoiser {
    constructor() {
        // TODO block new queries until previous queue is finished (with option to cancel)
        this.queue = [];
        this.model = () => {console.error("Model not yet loaded.")};
        this.loadModel();
    }

    dequeue() {
        // TODO investigate batch dequeueing

        if (this.queue.length < FFConfig.CONTEXT_FRAMES) {
            console.debug(`Cannot dequeue: not enough frames ready (${this.queue.length})`);
            return;
        }

        // Get next CONTEXT_FRAMES of frames



        this.queue.shift();
    }

    loadModel(){
        this.model = tf.loadLayersModel('/cnn/model.json')
            .then(this.dequeue())
            .catch((e) => {console.error(e)});
    }

    addBulkToQueue(CNNImgInput) {
        let cnnInputData = tf.browser.fromPixels(CNNImgInput, 1);
        console.debug("Raw image input tensor ", cnnInputData);
        cnnInputData = cnnInputData.transpose([1, 0, 2]);
        console.debug("Transposed input tensor ", cnnInputData);

        // Should be an even number
        const pad = FFConfig.CONTEXT_FRAMES / 2;
        const paddedInputData = cnnInputData.pad([[pad, pad], [0, 0], [0, 0]]);
        console.debug("Padded input tensor ", paddedInputData);

        // TODO use strided slice for extracting data?
        // https://js.tensorflow.org/api/latest/#stridedSlice
    }
}
