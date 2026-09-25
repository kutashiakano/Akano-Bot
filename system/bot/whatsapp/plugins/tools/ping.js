import sdkFacade from "../../../sdk/index.js";
let handler = async m => {
  m.reply("Pong!");
};

export default sdkFacade.define({
  name: /^(ping)$/i,
  category: "general",
  help: [ "ping" ][0] || "",
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});