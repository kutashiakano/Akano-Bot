let handler = async m => {
  m.reply("Pong!");
};

const { define: define } = require("../../../sdk");

module.exports = define({
  name: /^(ping)$/i,
  category: "general",
  help: [ "ping" ][0] || "",
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});