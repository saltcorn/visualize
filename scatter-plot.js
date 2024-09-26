const Field = require("@saltcorn/data/models/field");
const FieldRepeat = require("@saltcorn/data/models/fieldrepeat");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const db = require("@saltcorn/data/db");
const Workflow = require("@saltcorn/data/models/workflow");

const { div, script, domReady } = require("@saltcorn/markup/tags");
const {
  stateFieldsToWhere,
  readState,
} = require("@saltcorn/data/plugin-helper");
const { get_state_fields } = require("./utils");

const scatterForm = async (table, autosave) => {
  const fields = await table.getFields();
  const x_fields = fields
    .filter((f) => ["Date", "Float", "Integer"].includes(f.type.name))
    .map((f) => f.name);
  const y_fields = fields
    .filter((f) => ["Date", "Float", "Integer"].includes(f.type.name))
    .map((f) => f.name);
  const group_fields = fields
    .filter((f) => ["Integer", "String"].includes(f.type.name) || f.is_fkey)
    .map((f) => f.name);
  const maybeAddDisabledTitle = (os) =>
    autosave ? [{ name: "", label: "Select...", disabled: true }, ...os] : os;
  return new Form({
    fields: [
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
      {
        name: "show_legend",
        label: "Show legend",
        type: "Bool",
      },
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
        name: "num_plots",
        label: "Plot series",
        type: "String",
        required: true,
        attributes: {
          options: ["Single", "Multiple", "Group by field"],
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
        showIf: { num_plots: ["Single", "Group by field"] },
      },
      {
        name: "group_field",
        label: "Grouping field",
        type: "String",
        required: true,
        attributes: {
          options: maybeAddDisabledTitle(group_fields),
        },
        showIf: { num_plots: ["Group by field"] },
      },
      {
        name: "style",
        label: "Style",
        type: "String",
        required: true,
        attributes: {
          options: maybeAddDisabledTitle(["lines", "markers", "lines+markers"]),
        },
        showIf: { num_plots: ["Single", "Group by field"] },
      },
      {
        name: "y_title",
        label: "Y axis title",
        type: "String",
        showIf: { num_plots: "Multiple" },
        required: false,
      },
      new FieldRepeat({
        name: "series",
        label: "Series",
        showIf: { num_plots: "Multiple" },
        fields: [
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
              options: maybeAddDisabledTitle([
                "lines",
                "markers",
                "lines+markers",
              ]),
            },
          },
          {
            name: "color",
            label: "Color",
            type: "Color",
          },
        ],
      }),
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
  {
    x_field,
    y_field,
    style,
    title,
    y_title,
    group_field,
    height,
    num_plots,
    series,
    show_legend,
  },
  state,
  preview
) => {
  const fields = await table.getFields();
  readState(state, fields);
  const divid = `plot${Math.round(100000 * Math.random())}`;
  const xfld = fields.find((f) => f.name === x_field);
  const yfld = fields.find((f) => f.name === y_field);
  const where = await stateFieldsToWhere({ fields, state });
  const joinFields = {};
  const gfield = fields.find((f) => f.name === group_field);
  let group_by_joinfield = false;
  if (num_plots === "Group by field") {
    if (gfield?.is_fkey && gfield.attributes.summary_field) {
      group_by_joinfield = true;
      joinFields.__groupjoin = {
        ref: group_field,
        target: gfield.attributes.summary_field,
      };
    }
  }
  const rows = await table.getJoinedRows({
    where,
    joinFields,
    orderBy: x_field,
    limit: preview ? 100 : undefined,
  });
  const data = [];
  if (num_plots === "Multiple") {
    for (const { y_field, style, color } of series) {
      const y = rows.map((r) => r[y_field]);
      const x = rows.map((r) => r[xfld.name]);
      const pt = {
        type: "scatter",
        mode: style,
        name: y_field,
        x,
        y,
      };
      if (style === "lines") pt.line = { color };
      if (style === "markers") pt.marker = { color };
      if (style === "lines+markers") {
        pt.line = { color };
        pt.marker = { color };
      }
      data.push(pt);
    }
  } else if (num_plots === "Group by field") {
    const grpfld = group_by_joinfield ? "__groupjoin" : group_field;
    const diffvals = new Set(rows.map((r) => r[grpfld]));

    for (const val of [...diffvals]) {
      const myRows = rows.filter((r) => r[grpfld] === val);
      const y = myRows.map((r) => r[yfld.name]);
      const x = myRows.map((r) => r[xfld.name]);
      const pt = {
        type: "scatter",
        mode: style,
        name: val === null ? "null" : val,
        x,
        y,
      };
      data.push(pt);
    }
  } else {
    const y = rows.map((r) => r[yfld.name]);
    const x = rows.map((r) => r[xfld.name]);
    const pt = {
      type: "scatter",
      mode: style,
      x,
      y,
      name: yfld.label,
    };

    data.push(pt);
  }
  var config = {
    displayModeBar: false,
    responsive: true,
  };
  const ytitle =
    num_plots === "Multiple"
      ? y_title || series.map((s) => s.y_field).join(" ")
      : fieldToLabel(yfld);
  var layout = {
    title,
    showlegend: !!show_legend,
    height: +height,
    margin: title ? { pad: 4, t: 40, r: 25 } : { pad: 4, t: 10, r: 25 },
    xaxis: { title: fieldToLabel(xfld), automargin: true },
    yaxis: { title: ytitle, automargin: true },
  };
  return (
    div({ id: divid }) +
    script(
      domReady(
        plotly(divid, data, layout, config) +
          `setTimeout(()=>Plotly.Plots.resize('${divid}'), 250);
        setTimeout(()=>Plotly.Plots.resize('${divid}'), 500);
        setTimeout(()=>Plotly.Plots.resize('${divid}'), 750);
        setInterval(()=>Plotly.Plots.resize('${divid}'), 1000);`
      )
    )
  );
};
module.exports = { scatterForm, scatterPlot };
