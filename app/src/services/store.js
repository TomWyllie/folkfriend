/* https://vuejs.org/v2/guide/state-management.html#Simple-State-Management-from-Scratch */
// Vuex is overkill for out needs. Use a very simple global object store for
//  very basic state management.

const store = {
    state: {

    },
    setEntry(key, val) {
        // console.debug(`setEntry triggered with [${key}]`, val);
        this.state[key] = val;
    },
    clearEntry(key) {
        // console.debug(`clearEntry triggered [${key}]`);
        this.state[key] = null;
    }
};

export default store