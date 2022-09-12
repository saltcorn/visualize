const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const db = require("@saltcorn/data/db");
const Workflow = require("@saltcorn/data/models/workflow");

const { div, script, domReady } = require("@saltcorn/markup/tags");
const { stateFieldsToWhere } = require("@saltcorn/data/plugin-helper");
const { get_state_fields, readState } = require("./utils");

const scatterForm = async (table, autosave) => {
  const fields = await table.getFields();
  const x_fields = fields
    .filter((f) => ["Date", "Float", "Integer"].includes(f.type.name))
    .map((f) => f.name);
  const y_fields = fields
    .filter((f) => ["Date", "Float", "Integer"].includes(f.type.name))
    .map((f) => f.name);
  const maybeAddDisabledTitle = (os) =>
    autosave ? [{ name: "", label: "Select...", disabled: true }, , ...os] : os;
  return new Form({
    fields: [
      {
        name: "x_field",
        label: "X axis field",
        type: "String",
        required: true,
        attributes: {
          options: maybeAddDisabledTitle(x_fields),
        },
      },
      {
        name: "y_field",
        label: "Y axis field",
        type: "String",
        required: true,
        attributes: {
          options: maybeAddDisabledTitle(y_fields),
        },
      },
      {
        name: "style",
        label: "Style",
        type: "String",
        required: true,
        attributes: {
          options: maybeAddDisabledTitle(["lines", "markers", "lines+markers"]),
        },
      },
      {
        name: "title",
        label: "Plot title",
        type: "String",
        required: false,
      },
      {
        name: "height",
        label: "Height",
        type: "Integer",
        required: true,
        default: 450,
      },
    ],
  });
};

const fieldToLabel = (fld) =>
  fld.attributes && fld.attributes.units
    ? `${fld.label} [${fld.attributes.units}]`
    : fld.label;

const plotly = (id, ...args) =>
  `Plotly.newPlot(document.getElementById("${id}"),${args
    .map(JSON.stringify)
    .join()});`;

const scatterPlot = async (
  table,
  { x_field, y_field, style, title, height },
  state
) => {
  const fields = await table.getFields();
  readState(state, fields);
  const divid = `plot${Math.round(100000 * Math.random())}`;
  const xfld = fields.find((f) => f.name === x_field);
  const yfld = fields.find((f) => f.name === y_field);
  const where = await stateFieldsToWhere({ fields, state });
  const rows = await table.getRows(where, { orderBy: x_field });
  const y = rows.map((r) => r[yfld.name]);
  const x = rows.map((r) => r[xfld.name]);
  const data = [
    {
      type: "scatter",
      mode: style,
      x,
      y,
    },
  ];
  var config = {
    displayModeBar: false,
    responsive: true,
  };
  var layout = {
    title,
    showlegend: false,
    height: +height,
    margin: title
      ? { pad: 4, t: 40, r: 25 }
      : { pad: 4, t: 10, r: 25 },
    xaxis: { title: fieldToLabel(xfld), automargin: true },
    yaxis: { title: fieldToLabel(yfld), automargin: true },
  };
  return (
    div({ id: divid }) + script(domReady(plotly(divid, data, layout, config)))
  );
};
module.exports = { scatterForm, scatterPlot };
