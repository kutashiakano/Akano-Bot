let handler = async (m) => {
  m.reply("Pong!");
};
const { define } = require("../../../plugin");

module.exports = define({
  name: /^(ping)$/i,
  category: (["general"])[0] || "tools",
  help: (["ping"])[0] || "",
  reg: true,
  run: function (c) { return handler.apply(c.that, [c.m, c.props]); },
});
