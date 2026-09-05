const {mkImgCmd: mkImgCmd} = require("./command");

const __orig = mkImgCmd({
  name: "grayscale",
  description: "Convert an image to black and white",
  effect: "grayscale"
});

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "grayscale" ],
  category: "images",
  help: "Convert an image to black and white",
  options: Array.isArray(__orig.options) ? __orig.options : [],
  run: async ctx => __orig.execute.call(__orig, ctx.interaction)
});