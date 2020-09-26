const CopyPlugin = require('copy-webpack-plugin');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const StatsPlugin = require('stats-webpack-plugin')

module.exports = {
    configureWebpack: (config) => {
        // For some reason push causes it to fail. Something to do with the last
        //  entry in the rules being slightly different (has a pre field?). I am
        //  not experienced enough with Vue / Webpack to read any more into this.
        config.module.rules.unshift({
            test: /\.worker\.js$/i,
            use: [
                {
                    loader: 'comlink-loader',
                    options: {
                        singleton: true
                    }
                }
            ]
        });

        config.plugins.push(
            new CopyPlugin({
                patterns: [
                    // Non com-linked transcriber expects js/ff-wasm.wasm because inline with app.js
                    // {from: 'src/folkfriend/ff-wasm.wasm', to: 'js/ff-wasm.wasm'},
                    //  Com-linked worker JS lives in separate file and so expects ff-wasm.wasm
                    {from: 'src/folkfriend/ff-wasm.wasm', to: 'ff-wasm.wasm'},

                    {from: 'src/folkfriend/shaders/fragment.glsl', to: 'shaders/fragment.glsl'},
                    {from: 'src/folkfriend/shaders/vertex.glsl', to: 'shaders/vertex.glsl'}
                ],
            }),
            new BundleAnalyzerPlugin(),
            new StatsPlugin('stats.json')
        )
    }
};
