const { mkImgCmd } = require("./command");

const __orig = mkImgCmd({
  name: "sepia",
  description: "Apply a sepia tone filter",
  effect: "sepia",
});const { define } = require("../../../plugin");

module.exports = define({
  name: ["sepia"],
  category: "images",
  help: "Apply a sepia tone filter",
  options: Array.isArray(__orig.options) ? __orig.options : [],
  run: async (ctx) => __orig.execute.call(__orig, ctx.interaction),
});
