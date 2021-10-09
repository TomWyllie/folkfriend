import * as Comlink from "comlink";

class FFBackend {
    /* Yet another layer of abstraction. This class is the route that all 
        information to / from the WebAssembly backend must pass through.
        This is the class that the app directly uses to make use of folkfriend.
        It uses comlink and callbacks to communicate with the worker thread,
        which actually loads in the WebAssembly module.
    */

    constructor() {
        const worker = new Worker("/js/worker.js", { type: "module" });
        this.folkfriendWASMWrapper = Comlink.wrap(worker);
    }

    /* Function with no args that returns values */
    async version() {
        return new Promise(resolve => {
            this.folkfriendWASMWrapper.version(Comlink.proxy(version => {
                resolve(version);
            }))
        });
    }

    /* Function with args but no return values */
    async loadIndexFromJSONString(JSONString) {
        await this.folkfriendWASMWrapper.loadIndexFromJSONString(JSONString);
    }
}

const ffBackend = new FFBackend();
export default ffBackend;