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
    ],
  });
  return form;
};
const run = async (table_id, viewname, cfg, state, { res, req }) => {
  const form = await getForm({ viewname });
  return renderForm(form, req.csrfToken());
};
const runPost = async (table_id, viewname, config, state, body, { req }) => {
  const form = await getForm({ viewname });
  form.validate(body);
  return renderForm(form, req.csrfToken());
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
