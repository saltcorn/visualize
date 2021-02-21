const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const db = require("@saltcorn/data/db");
const Workflow = require("@saltcorn/data/models/workflow");
const { renderForm } = require("@saltcorn/markup");
const { proportionsForm, proportionsPlot } = require("./proportions-plot");
const { scatterForm, scatterPlot } = require("./scatter-plot");
const { div, script, domReady } = require("@saltcorn/markup/tags");

const configuration_workflow = () =>
  new Workflow({
    steps: [],
  });
const getForm = async ({ viewname, body }) => {
  const tables = await Table.find({});
  const fields = [
    {
      name: "table",
      label: "Table",
      type: "String",
      required: true,
      attributes: {
        options: tables.map((t) => t.name),
      },
    },
    {
      name: "plottype",
      label: "Plot type",
      type: "String",
      required: true,
      attributes: {
        options: ["Proportion", "Relation"],
      },
    },
  ];
  if (body && body.plottype && body.table) {
    const table = await Table.findOne({ name: db.sqlsanitize(body.table) });
    switch (body.plottype) {
      case "Proportion":
        const propForm = await proportionsForm(table);
        fields.push(...propForm.fields);
        break;
      case "Relation":
        const scatForm = await scatterForm(table);
        fields.push(...scatForm.fields);
        break;
    }
  }
  const form = new Form({
    action: `/view/${viewname}`,
    fields,
    onChange: "$(this).submit()",
    noSubmitButton: true,
    additionalButtons: [
      {
        label: "Save as view",
        onclick: "save_as_view(this)",
        class: "btn btn-primary",
      },
    ],
  });
  return form;
};

const js = (viewname) =>
  script(`
function save_as_view(that) {
  const form = $(that).parent('form');
  console.log(form);
  view_post("${viewname}", "save_as_view", form.serialize())
}
`);
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
  const form = await getForm({ viewname, body });
  form.validate(body);
  let plot = "";
  if (!form.hasErrors) {
    const table = await Table.findOne({ name: form.values.table });

    switch (form.values.plottype) {
      case "Proportion":
        plot = await proportionsPlot(table, form.values, {});

        break;
      case "Relation":
        plot = await scatterPlot(table, form.values, {});

        break;
    }
  }
  res.sendWrap("Data explorer", [
    renderForm(form, req.csrfToken()),
    js(viewname),
    plot,
  ]);
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
