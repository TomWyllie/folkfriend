const WorkerPlugin = require("worker-plugin");

const fs = require('fs')
const packageJson = fs.readFileSync('./package.json')
const version = JSON.parse(packageJson).version || "";
const webpack = require('webpack');

module.exports = {
  transpileDependencies: [
    'vuetify'
  ],
  configureWebpack: {
    plugins: [
      new WorkerPlugin(),
      // This is just to pull the version from package.json into ffConfig.js
      new webpack.DefinePlugin({
        'process.env': {
          PACKAGE_VERSION: '"' + version + '"'
        }
      })
    ],
  },
  pwa: {
    name: "FolkFriend",
    theme_color: '#055581',
  }
}
