const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const db = require("@saltcorn/data/db");
const Workflow = require("@saltcorn/data/models/workflow");

const { div, script, domReady } = require("@saltcorn/markup/tags");
const { get_state_fields, readState } = require("./utils");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "views",
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          const outcome_fields = fields
            .filter((f) => ["Float", "Integer"].includes(f.type.name))
            .map((f) => f.name);
          const factor_fields = fields
            .filter(
              (f) =>
                ["String", "Bool", "Integer"].includes(f.type.name) || f.is_fkey
            )
            .map((f) => f.name);
          return new Form({
            fields: [
              {
                name: "outcome_field",
                label: "Outcome",
                type: "String",
                sublabel: "Row count or field to sum up for total",
                required: true,
                attributes: {
                  options: ["Row count", ...outcome_fields].join(),
                },
              },
              {
                name: "factor_field",
                label: "Factor",
                type: "String",
                sublabel: "E.g the different wedges in a pie chart",
                required: true,
                attributes: {
                  options: factor_fields.join(),
                },
              },
              {
                name: "null_label",
                label: "Label for missing factor values",
                type: "String",
                required: false,
              },
              {
                name: "style",
                label: "Style",
                type: "String",
                required: true,
                attributes: {
                  options: "Donut chart,Bar chart, Pie chart",
                },
              },
              {
                name: "label_position",
                label: "Label Position",
                type: "String",
                required: true,
                attributes: {
                  options: "Legend,Inside,Outside",
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
        },
      },
    ],
  }); //http://localhost:3000/view/PIES?category=Fun

const splitState = (factor, state, fields) => {
  var noFactor = [];
  var hasFactor = false;
  var hasNoFactor = false;
  Object.entries(state).forEach(([k, v]) => {
    if (k === factor) hasFactor = true;
    else {
      const field = fields.find((f) => f.name == k);
      if (field) {
        noFactor[k] = v;
        hasNoFactor = true;
      }
    }
  });
  return { noFactor, hasFactor, hasNoFactor };
};

const run = async (
  table_id,
  viewname,
  {
    outcome_field,
    factor_field,
    style,
    title,
    null_label,
    label_position = "Legend",
    height = 450,
  },
  state,
  extraArgs
) => {
  const table = await Table.findOne({ id: table_id });
  const fields = await table.getFields();
  readState(state, fields);
  const divid = `plot${Math.round(100000 * Math.random())}`;
  const isCount = outcome_field === "Row count";
  const factor_field_field = fields.find((f) => f.name === factor_field);
  if (!factor_field_field)
    throw new Error(
      `visualize incorrectly configured: factor field "${factor_field}" is not a valid field.`
    );
  const isJoin = factor_field_field.type === "Key";
  const { noFactor, hasFactor } = splitState(factor_field, state, fields);
  const { where, values } = db.mkWhere(noFactor);
  const joinTable = isJoin
    ? db.sqlsanitize(factor_field_field.reftable_name)
    : "";
  const join = isJoin
    ? `left join ${db.getTenantSchemaPrefix()}"${joinTable}" j on j.id="${db.sqlsanitize(
        factor_field
      )}"`
    : "";
  const the_factor = isJoin
    ? `j."${db.sqlsanitize(
        factor_field_field.attributes.summary_field || "id"
      )}"`
    : `"${db.sqlsanitize(factor_field)}"`;
  const outcome = isCount
    ? `COUNT(*)`
    : `SUM("${db.sqlsanitize(outcome_field)}")`;

  const selJoin = isJoin ? `, "${factor_field}" as fkey` : "";
  const groupBy = isJoin
    ? `"${db.sqlsanitize(factor_field)}", ${the_factor}`
    : `"${db.sqlsanitize(factor_field)}"`;
  const tail = `${where} group by ${groupBy}`;
  const sql = `select ${outcome}, ${the_factor} as "${db.sqlsanitize(
    factor_field
  )}"${selJoin} from ${table.sql_name} ${join} ${tail}`;

  const rows_db = (await db.query(sql, values)).rows;
  var rows;
  if (
    !isJoin &&
    factor_field_field.attributes &&
    factor_field_field.attributes.options
  ) {
    var colOpts = factor_field_field.attributes.options
      .split(",")
      .map((s) => s.trim());
    rows = colOpts.map((factor) => {
      const rowdb = rows_db.find((row) => row[factor_field] == factor);
      if (rowdb) return rowdb;
      else return { [factor_field]: factor, [isCount ? "count" : "sum"]: 0 };
    });
  } else rows = rows_db;
  const y = rows.map((r) => (isCount ? r.count : r.sum));
  const x = rows.map((r) => {
    const v = r[factor_field];
    if (v === null && null_label) return null_label;
    else return v;
  });
  const customdata = isJoin ? rows.map((r) => r.fkey) : undefined;
  const data =
    style === "Bar chart"
      ? [
          {
            type: "bar",
            x,
            y,
            customdata,
            marker: {
              color: hasFactor
                ? rows.map((r) =>
                    (isJoin ? `${r.fkey}` : r[factor_field]) ===
                    state[factor_field]
                      ? "rgb(31, 119, 180)"
                      : "rgb(150, 150, 150)"
                  )
                : "rgb(31, 119, 180)",
            },
          },
        ]
      : [
          {
            type: "pie",
            labels: x,
            values: y,
            customdata,
            textinfo: label_position === "Legend" ? "percent" : "label+percent",
            textposition:
              label_position === "Legend"
                ? undefined
                : label_position === "Outside"
                ? "outside"
                : "inside",
            pull: hasFactor
              ? rows.map((r) =>
                  (isJoin ? r.fkey : r[factor_field]) === state[factor_field]
                    ? 0.1
                    : 0.0
                )
              : undefined,
            hole: style === "Donut chart" ? 0.5 : 0.0,
          },
        ];

  var layout = {
    title,
    showlegend: label_position === "Legend",
    height: +height,
    margin: title
      ? { l: 50, pad: 4, t: 40, b: 30, r: 25 }
      : { l: 50, pad: 4, t: 10, b: 30, r: 25 },
  };
  var config = {
    displayModeBar: false,
    responsive: true,
  };
  return (
    div({ id: divid }) +
    script(
      domReady(
        plotly(
          divid,
          factor_field,
          state[factor_field],
          isJoin,
          data,
          layout,
          config
        )
      )
    )
  );
};

const plotly = (id, factor, selected, isJoin, ...args) =>
  `Plotly.plot(document.getElementById("${id}"),${args
    .map(JSON.stringify)
    .join()});
  document.getElementById("${id}").on('plotly_click', function(data){
    if(data.points.length>0) {
      var label = ${
        isJoin ? "data.points[0].customdata[0]" : "data.points[0].label"
      };
      if(label===${selected ? JSON.stringify(selected) : selected}) {
        unset_state_field("${factor}");
      } else
        set_state_field("${factor}",label);
    }
  });`;

module.exports = {
  name: "ProportionsVis",
  display_state_form: false,
  get_state_fields,
  configuration_workflow,
  run,
};
