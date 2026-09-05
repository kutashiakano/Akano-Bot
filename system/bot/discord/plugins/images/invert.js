const {mkImgCmd: mkImgCmd} = require("./command");

const __orig = mkImgCmd({
  name: "invert",
  description: "Invert the colors of an image",
  effect: "invert"
});

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "invert" ],
  category: "images",
  help: "Invert the colors of an image",
  options: Array.isArray(__orig.options) ? __orig.options : [],
  run: async ctx => __orig.execute.call(__orig, ctx.interaction)
});