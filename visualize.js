const { features } = require("@saltcorn/data/db/state");
const Form = require("@saltcorn/data/models/form");
const Workflow = require("@saltcorn/data/models/workflow");

module.exports = {
  headers: (cfg) => [
    {
      script: `/plugins/public/visualize${
        features?.version_plugin_serve_path
          ? "@" + require("./package.json").version
          : ""
      }/plotly.min.js`,
      onlyViews: [
        "ProportionsVis",
        "RelationsVis",
        "DistributionVis",
        "Data Explorer",
        "Pivot table",
      ],
    },
  ],
  sc_plugin_api_version: 1,
  plugin_name: "visualize",
  viewtemplates: (cfg) => {
    return [
      require("./proportions")(cfg),
      require("./scatter"),
      require("./distribution"),
      require("./data-explorer"),
    ];
  },
  configuration_workflow: () => {
    return new Workflow({
      steps: [
        {
          name: "colors",
          form: () => {
            return new Form({
              fields: [
                {
                  name: "colors",
                  label: "Colors",
                  type: "String",
                  sublabel:
                    "Comma-separated list of colors for ProportionsVis views (in Hex-format e.g. #2c3e50,#95a5a6,#18bc9c)",
                  validator: (s) => {
                    if (s) {
                      const colors = s.split(",");
                      if (colors.some((c) => !c.match(/^#[0-9a-fA-F]{6}$/)))
                        return "Invalid color format";
                    }
                    return true;
                  },
                },
              ],
            });
          },
        },
      ],
    });
  },
};
