const Form = require("@saltcorn/data/models/form");
const User = require("@saltcorn/data/models/user");
const db = require("@saltcorn/data/db");

const { div, script, domReady, code } = require("@saltcorn/markup/tags");
const { get_state_fields, resizer } = require("./utils");
const {
  readState,
  stateFieldsToWhere,
} = require("@saltcorn/data/plugin-helper");
const { mergeIntoWhere, prefixFieldsInWhere } = require("@saltcorn/data/utils");
const { jsexprToWhere } = require("@saltcorn/data/models/expression");
const { getState } = require("@saltcorn/data/db/state");
const proportionsForm = async (table, autosave) => {
  const fields = await table.getFields();
  const outcome_fields = fields
    .filter((f) => ["Float", "Integer", "Money"].includes(f.type.name))
    .map((f) => f.name);
  const factor_fields = fields
    .filter(
      (f) => ["String", "Bool", "Integer"].includes(f.type.name) || f.is_fkey
    )
    .map((f) => f.name);
  const maybeAddDisabledTitle = (os) =>
    autosave ? [{ name: "", label: "Select...", disabled: true }, ...os] : os;
  return new Form({
    fields: [
      {
        name: "outcome_field",
        label: "Outcome",
        type: "String",
        sublabel: "Row count or field to sum up for total",
        required: true,
        attributes: {
          options: maybeAddDisabledTitle(outcome_fields),
        },
      },
      {
        name: "statistic",
        label: "Statistic",
        type: "String",
        sublabel: "Statistic applied to outcome",
        required: true,
        attributes: {
          options: ["Count", "Avg", "Sum", "Max", "Min"],
        },
      },
      {
        name: "factor_field",
        label: "Factor",
        type: "String",
        sublabel: "E.g the different wedges in a pie chart",
        required: true,
        attributes: {
          options: maybeAddDisabledTitle(factor_fields),
        },
      },
      {
        name: "include_fml",
        label: "Row inclusion formula",
        class: "validate-expression",
        sublabel:
          "Only include rows where this formula is true. " +
          "In scope:" +
          " " +
          [
            ...fields.map((f) => f.name),
            "user",
            "year",
            "month",
            "day",
            "today()",
          ]
            .map((s) => code(s))
            .join(", "),
        type: "String",
      },
      {
        name: "null_label",
        label: "Label for missing factor values",
        type: "String",
        required: false,
      },
      {
        name: "show_zero",
        label: "Show zeros",
        sublabel: "Show factors with count 0",
        type: "Bool",
        required: false,
        showIf: { statistic: "Count" },
      },
      {
        name: "style",
        label: "Style",
        type: "String",
        required: true,
        attributes: {
          options: [
            "Donut chart",
            "Pie chart",
            "Bar chart",
            "Horizontal Bar chart",
          ],
        },
      },
      {
        name: "axis_title",
        label: "Axis title",
        type: "String",
        required: false,
        showIf: { style: ["Bar chart", "Horizontal Bar chart"] },
      },

      {
        name: "lower_limit",
        label: "Lower value limit",
        type: "Float",
        required: false,
        showIf: { style: ["Bar chart", "Horizontal Bar chart"] },
      },
      {
        name: "upper_limit",
        label: "Upper value limit",
        type: "Float",
        required: false,
        showIf: { style: ["Bar chart", "Horizontal Bar chart"] },
      },
      {
        name: "label_position",
        label: "Label Position",
        type: "String",
        required: true,
        attributes: {
          options: ["Legend", "Inside", "Outside"],
        },
      },
      {
        name: "title",
        label: "Plot title",
        type: "String",
        required: false,
      },
      {
        name: "center_title",
        label: "Center title?",
        type: "Bool",
        required: false,
        showIf: { style: "Donut chart" },
      },
      {
        name: "height",
        label: "Height",
        type: "Integer",
        required: true,
        default: 450,
      },
      {
        input_type: "section_header",
        label: "Margins",
      },
      {
        name: "mleft",
        label: "Left (px)",
        type: "Integer",
        default: 25,
        attributes: { asideNext: true },
      },
      {
        name: "mright",
        label: "Right (px)",
        type: "Integer",
        default: 25,
      },
      {
        name: "mtop",
        label: "Top (px)",
        type: "Integer",
        default: 40,
        attributes: { asideNext: true },
      },
      {
        name: "mbottom",
        label: "Bottom (px)",
        type: "Integer",
        default: 25,
      },
    ],
  });
};

const splitState = (factor, state, fields) => {
  var noFactor = [];
  var hasFactor = false;
  var hasNoFactor = false;
  Object.entries(state).forEach(([k, v]) => {
    if (k === factor && !(v?.in || Array.isArray(v))) hasFactor = true;
    else {
      const field = fields.find((f) => f.name == k);
      if (field || k.startsWith("_fts_")) {
        noFactor[k] = v;
        hasNoFactor = true;
      }
    }
  });
  return { noFactor, hasFactor, hasNoFactor };
};
const plotly = (id, factor, selected, isJoin, null_label, ...args) =>
  `Plotly.newPlot(document.getElementById("${id}"),${args
    .map(JSON.stringify)
    .join()});
  document.getElementById("${id}").on('plotly_click', function(data){
    if(data.points.length>0) {
      var label = ${
        isJoin ? "data.points[0].customdata[0]" : "data.points[0].label"
      };
      if(label==='${null_label}') label = null;
      if((''+label)===(''+${selected ? JSON.stringify(selected) : selected})) {
        unset_state_field("${factor}");
      } else
        set_state_field("${factor}",label);
    }
  });`;

const or_if_undef = (x, y) => (typeof x === "undefined" ? y : x);

const getDarkBgColor = async (req) => {
  const state = getState();
  if (state.plugin_cfgs) {
    let anyBsThemeCfg = state.plugin_cfgs["any-bootstrap-theme"];
    if (!anyBsThemeCfg)
      anyBsThemeCfg = state.plugin_cfgs["@saltcorn/any-bootstrap-theme"];
    if (anyBsThemeCfg?.dark) {
      if (req.user?.id) {
        // does an user overwrite the global setting?
        const user = await User.findOne({ id: req.user.id });
        if (user?._attributes?.layout?.config?.mode) {
          if (user._attributes.layout.config.mode === "dark")
            return anyBsThemeCfg.dark;
          else return null;
        }
      }
      if (anyBsThemeCfg.mode === "dark") return anyBsThemeCfg.dark;
    }
  }
  return null;
};

const proportionsPlot = async (
  table,
  {
    outcome_field,
    statistic,
    factor_field,
    include_fml,
    style,
    title,
    center_title,
    show_zero,
    null_label,
    axis_title,
    upper_limit,
    lower_limit,
    label_position = "Legend",
    height = 450,
    mleft,
    mright,
    mtop,
    mbottom,
    colors = "",
  },
  state,
  req,
  context = {}
) => {
  const parsedColors = context.colors ? context.colors.split(",") : [];
  const darkBg = await getDarkBgColor(req);
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
  const whObj = prefixFieldsInWhere(
    stateFieldsToWhere({ fields, table, state: noFactor, prefix: "mt" }),
    "mt"
  );

  if (include_fml) {
    const ctx = { ...state, user_id: req?.user?.id || null, user: req.user };
    let where1 = jsexprToWhere(include_fml, ctx, fields);
    mergeIntoWhere(whObj, where1 || {});
  }

  const { where, values } = db.mkWhere(whObj);

  const joinTable = isJoin
    ? db.sqlsanitize(factor_field_field.reftable_name)
    : "";
  const join = isJoin
    ? `left join ${db.getTenantSchemaPrefix()}"${joinTable}" j on j.id=mt."${db.sqlsanitize(
        factor_field
      )}"`
    : "";
  const the_factor = isJoin
    ? `j."${db.sqlsanitize(
        factor_field_field.attributes.summary_field || "id"
      )}"`
    : `"${db.sqlsanitize(factor_field)}"`;
  const stat = db.sqlsanitize(statistic || "SUM").toLowerCase();
  const outcome = isCount
    ? `COUNT(*)`
    : `${stat}(mt."${db.sqlsanitize(outcome_field)}") as ${stat}`;

  const selJoin = isJoin ? `, mt."${factor_field}" as fkey` : "";
  const groupBy = isJoin
    ? `mt."${db.sqlsanitize(factor_field)}", ${the_factor}`
    : `mt."${db.sqlsanitize(factor_field)}"`;
  const tail = `${where} group by ${groupBy}`;
  const sql = `select ${outcome}, ${the_factor} as "${db.sqlsanitize(
    factor_field
  )}"${selJoin} from ${table.sql_name} mt ${join} ${tail}`;

  const rows_db = (await db.query(sql, values)).rows;
  var rows;
  if (
    !isJoin &&
    factor_field_field.attributes &&
    factor_field_field.attributes.options
  ) {
    const colOptsFromOpts = factor_field_field.attributes.options
      .split(",")
      .map((s) => s.trim());
    const colOptsFromData = new Set(rows_db.map((r) => r[factor_field]));
    const colOpts = [...new Set([...colOptsFromOpts, ...colOptsFromData])];
    rows = colOpts.map((factor) => {
      const rowdb = rows_db.find((row) => row[factor_field] == factor);
      if (rowdb) return rowdb;
      else return { [factor_field]: factor, [isCount ? "count" : stat]: 0 };
    });
  } else rows = rows_db;
  if (!show_zero && (isCount || stat === "count"))
    rows = rows.filter((r) => r.count > 0);
  const y = rows.map((r) => (isCount ? r.count : r[stat]));
  const x = rows.map((r) => {
    const v = r[factor_field];
    if ((v === null || v === "") && null_label) return null_label;
    else return v;
  });
  const customdata = isJoin ? rows.map((r) => r.fkey) : undefined;
  const isNull = (x) => x === "null" || x === "" || x === null;
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
                    (isJoin ? `${r.fkey}` : r[factor_field]) ==
                      state[factor_field] ||
                    (isNull(state[factor_field]) && isNull(r[factor_field]))
                      ? parsedColors.length >= 1
                        ? parsedColors[0]
                        : "rgb(31, 119, 180)"
                      : parsedColors.length >= 2
                      ? parsedColors[1]
                      : "rgb(150, 150, 150)"
                  )
                : parsedColors.length >= 1
                ? parsedColors[0]
                : "rgb(31, 119, 180)",
            },
          },
        ]
      : style === "Horizontal Bar chart"
      ? [
          {
            type: "bar",
            x: y,
            y: x,
            orientation: "h",
            customdata,
            marker: {
              color: hasFactor
                ? rows.map((r) =>
                    (isJoin ? `${r.fkey}` : r[factor_field]) ===
                      state[factor_field] ||
                    (isNull(state[factor_field]) && isNull(r[factor_field]))
                      ? parsedColors.length >= 1
                        ? parsedColors[0]
                        : "rgb(31, 119, 180)"
                      : parsedColors.length >= 2
                      ? parsedColors[1]
                      : "rgb(150, 150, 150)"
                  )
                : parsedColors.length >= 1
                ? parsedColors[0]
                : "rgb(31, 119, 180)",
            },
          },
        ]
      : [
          {
            marker: {
              colors: parsedColors,
            },
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

  let layout = {
    ...(darkBg
      ? {
          //paper_bgcolor: darkBg,
          plot_bgcolor: darkBg,
          font: { color: "#FFFFFF" },
        }
      : {}),
    paper_bgcolor: "rgba(0,0,0,0)",
    title: center_title
      ? {
          text: title,
          x: 0.5,
          y: 0.5,
          xref: "paper",
          yref: "paper",
          xanchor: "center",
          yanchor: "middle",
        }
      : title,
    showlegend: label_position === "Legend",
    height: +height,
    autosize: true,
    //margin: title ? { pad: 4, t: 40, r: 25 } : { pad: 4, t: 10, r: 25 },
    margin: {
      pad: 4,
      t: or_if_undef(mtop, title ? 40 : 10),
      r: or_if_undef(mright, 25),
      l: or_if_undef(mleft, undefined),
      b: or_if_undef(mbottom, undefined),
    },
    xaxis: {
      automargin: true,
    },
    yaxis: {
      automargin: true,
    },
  };
  if (style === "Bar chart") {
    layout.xaxis.nticks = x.length;
    layout.yaxis.title =
      axis_title ||
      (isCount ? "Count" : `${statistic || "Sum"} ${outcome_field}`);
    if (typeof lower_limit === "number" && typeof upper_limit === "number")
      layout.yaxis.range = [lower_limit, upper_limit];
  }
  if (style === "Horizontal Bar chart") {
    layout.yaxis.nticks = x.length;
    layout.xaxis.title =
      axis_title ||
      (isCount ? "Count" : `${statistic || "Sum"} ${outcome_field}`);
    if (typeof lower_limit === "number" && typeof upper_limit === "number")
      layout.xaxis.range = [lower_limit, upper_limit];
  }

  let config = {
    displayModeBar: false,
    responsive: true,
  };
  return (
    div({ id: divid, class: "" }) +
    script(
      domReady(
        plotly(
          divid,
          factor_field,
          state[factor_field],
          isJoin,
          null_label,
          data,
          layout,
          config
        ) + resizer(divid)
      )
    )
  );
};
module.exports = { proportionsForm, proportionsPlot };
