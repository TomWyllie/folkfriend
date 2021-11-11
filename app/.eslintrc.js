// eslint-disable-next-line no-undef
module.exports = {
    extends: [
        'plugin:vue/recommended'
    ],
    rules: {
        // override/add rules settings here, such as:
        'vue/html-indent': ['error', 4],
        'vue/script-indent': ['error', 4],
        'quotes': ['error', 'single'],
        'semi': ['error', 'always']
    },
    ignorePatterns: ['src/js/comlink.js', 'src/wasm/*']
};