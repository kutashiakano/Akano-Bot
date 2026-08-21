const { mkImgCmd } = require("./command");

const __orig = mkImgCmd({
  name: "contrast",
  description: "Adjust image contrast",
  options: [
    {
      name: "amount",
      type: 3,
      description: "Contrast -100 to 100 (default 50)",
      required: false,
    },
  ],
  effect: "contrast",
});const { define } = require("../../../plugin");

module.exports = define({
  name: ["contrast"],
  category: "images",
  help: "Adjust image contrast",
  options: Array.isArray(__orig.options) ? __orig.options : [],
  run: async (ctx) => __orig.execute.call(__orig, ctx.interaction),
});
