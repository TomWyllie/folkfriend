const WorkerPlugin = require("worker-plugin");

module.exports = {
  transpileDependencies: [
    'vuetify'
  ],
  configureWebpack: {
    plugins: [
      new WorkerPlugin()
    ],
  }
}
