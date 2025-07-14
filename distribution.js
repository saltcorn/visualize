const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const db = require("@saltcorn/data/db");
const Workflow = require("@saltcorn/data/models/workflow");

const { div, script, domReady } = require("@saltcorn/markup/tags");
const { stateFieldsToWhere } = require("@saltcorn/data/plugin-helper");
const { get_state_fields, readState } = require("./utils");

const {  distributionForm, distributionPlot } = require("./distribution-plot");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "views",
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          return await distributionForm(table);
        },
      },
    ],
  });

const run = async (table_id, viewname, cfg, state, extraArgs) => {
  const table = await Table.findOne({ id: table_id });
  return await distributionPlot(table, cfg, state, extraArgs?.isPreview);
};

module.exports = {
  name: "DistributionVis",
  display_state_form: false,
  description:
    "Visualise the distribution of a field value",
  get_state_fields,
  configuration_workflow,
  run,
};
