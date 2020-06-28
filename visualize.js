const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "views",
        form: async context => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          const outcome_fields = fields
            .filter(f => ["Float", "Integer"].includes(f.type.name))
            .map(f => f.name);
          const factor_fields = fields
            .filter(f => ["String", "Bool", "Integer"].includes(f.type.name))
            .map(f => f.name);
          return new Form({
            fields: [
              {
                name: "outcome_field",
                label: "Outcome",
                type: "String",
                sublabel:
                  "Row count or field to sum up for total",
                required: true,
                attributes: {
                  options: ["Row count", ...outcome_fields].join()
                }
              },
              {
                name: "factor_field",
                label: "Factor",
                type: "String",
                sublabel:
                  "E.g the different wedges in a pie chart",
                required: true,
                attributes: {
                  options: factor_fields.join()
                }
              },
              {
                name: "style",
                label: "Style",
                type: "String",
                required: true,
                attributes: {
                  options: "Pie,Donut,Bar chart"
                }
              }
            ]
          });
        }
      }
    ]
  });

module.exports = {
  headers: [
    {
      script:
        "https://cdnjs.cloudflare.com/ajax/libs/plotly.js/1.54.5/plotly.min.js",
      integrity: "sha256-qXgZ3jy1txdNZG0Lv20X3u5yh4892KqFcfF1SaOW0gI="
    }
  ],
  sc_plugin_api_version: 1,
  viewtemplates: [
    {
      name: "ProportionsVis",
      display_state_form: false,
      get_state_fields,
      configuration_workflow,
      run
    }
  ]
};
