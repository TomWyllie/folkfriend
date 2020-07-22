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

    dequeue() {
        console.info(tf.getBackend());

        // TODO investigate batch dequeueing

        if (this.queue.length < FFConfig.CONTEXT_FRAMES) {
            console.debug(`Cannot dequeue: not enough frames ready (${this.queue.length})`);
            return;
        }

        while(this.queue.length > FFConfig.CONTEXT_FRAMES) {
            // Get next CONTEXT_FRAMES of frames (batch size 1)
            let nextBlock = tf.concat(this.queue.slice(0, 16), 0).expandDims();
            // console.debug('CNN Input batch', nextBlock);
            console.time('CNN-predict');
            let prediction = this.model.predict(nextBlock);
            prediction = tf.cast(tf.round(prediction), 'bool');
            console.timeEnd('CNN-predict');
            // console.debug('CNN Output prediction', prediction);

            this.outQueue.push(prediction);
            this.queue.shift();
        }

        this.prediction = tf.concat(this.outQueue);

        // Pseudo -> not pseudo
        const initialShape = this.prediction.shape;
        this.prediction = this.prediction.reshape([initialShape[0], initialShape[1], 1]);
        this.prediction = tf.tile(this.prediction, [1, 1, FFConfig.BINS_PER_MIDI]);
        this.prediction = this.prediction.reshape([initialShape[0], initialShape[1] * FFConfig.BINS_PER_MIDI]);

        console.warn(this.prediction.shape);
        this.denoised = tf.mul(this.prediction, this.rawImgInputData);
    }

    loadModel(){
        tf.loadLayersModel('/cnn/model.json')
            .then(m => {
                this.model = m;
                this.dequeue()
            })
            .catch((e) => {console.error(e)});
    }

    addBulkToQueue(CNNImgInput) {
        let cnnInputData = tf.browser.fromPixels(CNNImgInput, 1);
        console.debug("Raw image input tensor ", cnnInputData);
        cnnInputData = cnnInputData.transpose([1, 0, 2]);
        console.debug("Transposed input tensor ", cnnInputData);

        // Need this for later for the actual denoising step
        this.rawImgInputData = cnnInputData.squeeze();
        console.debug("Squeezed data tensor ", this.rawImgInputData);

        cnnInputData = tf.cast(cnnInputData, 'float32');
        cnnInputData = tf.div(cnnInputData, tf.max(cnnInputData));

        // Should be an even number
        const pad = FFConfig.CONTEXT_FRAMES / 2;
        const paddedInputData = cnnInputData.pad([[pad, pad], [0, 0], [0, 0]]);
        console.debug("Padded input tensor ", paddedInputData);

        const numFrames = paddedInputData.shape[0];
        const numBins = paddedInputData.shape[1];

        for(let i = 0; i < numFrames; i++) {
            let slice = tf.slice3d(paddedInputData, [i], [1, numBins, 1]);
            this.queue.push(slice);
        }
    }
}
