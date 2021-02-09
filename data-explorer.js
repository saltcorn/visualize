const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const db = require("@saltcorn/data/db");
const Workflow = require("@saltcorn/data/models/workflow");
const { renderForm } = require("@saltcorn/markup");

const configuration_workflow = () =>
  new Workflow({
    steps: [],
  });
const getForm = async ({ viewname }) => {
  const tables = await Table.find({});
  const axisOptions = {};
  for (const t of tables) {
    const flds = await t.getFields();
    axisOptions[t.name] = flds
      .filter((f) => ["Float", "Integer", "Date"].includes(f.type.name))
      .map((f) => f.name);
  }
  const form = new Form({
    action: `/view/${viewname}`,
    fields: [
      {
        name: "table",
        label: "Table",
        type: "String",
        required: true,
        attributes: {
          options: tables.map((t) => t.name).join(),
        },
      },
      {
        name: "x_field",
        label: "X axis field",
        type: "String",
        required: true,
        attributes: {
          calcOptions: ["table", axisOptions],
        },
      },
      {
        name: "y_field",
        label: "Y axis field",
        type: "String",
        required: true,
        attributes: {
          calcOptions: ["table", axisOptions],
        },
      },
    ],
  });
  return form;
};
const run = async (table_id, viewname, cfg, state, { res, req }) => {
  const form = await getForm({ viewname });
  return renderForm(form, req.csrfToken());
};
const runPost = async (
  table_id,
  viewname,
  config,
  state,
  body,
  { req, res }
) => {
  const form = await getForm({ viewname });
  form.validate(body);

  res.sendWrap("Data explorer", renderForm(form, req.csrfToken()));
};
module.exports = {
  name: "Data Explorer",
  display_state_form: false,
  tableless: true,
  description: "Explore data and create plots",
  get_state_fields: () => [],
  configuration_workflow,
  run,
  runPost,
};
