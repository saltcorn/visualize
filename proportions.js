const Table = require("@saltcorn/data/models/table");
const Workflow = require("@saltcorn/data/models/workflow");

const { get_state_fields, readState } = require("./utils");
const { proportionsForm, proportionsPlot } = require("./proportions-plot");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "views",
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          return await proportionsForm(table);
        },
      },
    ],
  }); //http://localhost:3000/view/PIES?category=Fun

const run = async (table_id, viewname, cfg, state, extraArgs) => {
  const table = await Table.findOne(table_id);
  return await proportionsPlot(table, cfg, state, extraArgs.req);
};

module.exports = {
  name: "ProportionsVis",
  description:
    "Visualise proportions in a table with a bar, pie or doughnut chart",
  display_state_form: false,
  get_state_fields,
  configuration_workflow,
  run,
};
