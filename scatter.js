const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const db = require("@saltcorn/data/db");
const Workflow = require("@saltcorn/data/models/workflow");

const { div, script, domReady } = require("@saltcorn/markup/tags");
const { stateFieldsToWhere } = require("@saltcorn/data/plugin-helper");
const { get_state_fields, readState } = require("./utils");

const { scatterForm, scatterPlot } = require("./scatter-plot");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "views",
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          return await scatterForm(table);
        },
      },
    ],
  });

const run = async (table_id, viewname, cfg, state, extraArgs) => {
  const table = await Table.findOne({ id: table_id });
  return await scatterPlot(table, cfg, state, extraArgs?.isPreview);
};

module.exports = {
  name: "RelationsVis",
  display_state_form: false,
  description:
    "Visualise the relationship between two fields as a line or scatter plot",
  get_state_fields,
  configuration_workflow,
  run,
};
