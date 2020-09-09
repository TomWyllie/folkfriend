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
    }
};
