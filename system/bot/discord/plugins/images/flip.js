const {mkImgCmd: mkImgCmd} = require("./command");

const __orig = mkImgCmd({
  name: "flip",
  description: "Flip an image horizontally",
  effect: "flip"
});

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "flip" ],
  category: "images",
  help: "Flip an image horizontally",
  options: Array.isArray(__orig.options) ? __orig.options : [],
  run: async ctx => __orig.execute.call(__orig, ctx.interaction)
});