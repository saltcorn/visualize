const Field = require("@saltcorn/data/models/field");
const Table = require("@saltcorn/data/models/table");

const get_state_fields = async (table_id, viewname, { show_view }) => {
  const table = Table.findOne(table_id);
  const table_fields = table.fields;
  return table_fields.map((f) => {
    const sf = new Field(f);
    sf.required = false;
    return sf;
  });
};
const readState = (state, fields) => {
  fields.forEach((f) => {
    const current = state[f.name];
    if (typeof current !== "undefined") {
      if (f.type.read) state[f.name] = f.type.read(current);
      else if (f.type === "Key")
        state[f.name] = current === "null" ? null : +current;
    }
  });
  return state;
};

const resizer = (divid) =>
  `setTimeout(()=>{if($("#${divid}").length) Plotly.Plots.resize('${divid}')}, 250);
setTimeout(()=>{if($("#${divid}").length) Plotly.Plots.resize('${divid}')}, 500);
setTimeout(()=>{if($("#${divid}").length) Plotly.Plots.resize('${divid}')}, 750);
setInterval(()=>{if($("#${divid}").length) Plotly.Plots.resize('${divid}')}, 1000);`;

module.exports = { get_state_fields, readState, resizer };
