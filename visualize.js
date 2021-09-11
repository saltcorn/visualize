module.exports = {
  headers: [
    {
      script: "/plugins/public/visualize/plotly.min.js",
    },
  ],
  sc_plugin_api_version: 1,
  plugin_name: "visualize",
  viewtemplates: [
    require("./proportions"),
    require("./scatter"),
    require("./data-explorer"),
  ],
};
