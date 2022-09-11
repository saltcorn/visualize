const { features } = require("@saltcorn/data/db/state");

module.exports = {
  headers: [
    {
      script: `/plugins/public/visualize${features?.version_plugin_serve_path
        ? "@" + require("./package.json").version
        : ""
        }/plotly.min.js`,
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
