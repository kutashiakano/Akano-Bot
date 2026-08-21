const { mkImgCmd } = require("./command");

const __orig = mkImgCmd({
  name: "blur",
  description: "Blur an image",
  options: [
    {
      name: "amount",
      type: 4,
      description: "Blur intensity (1-50, default 3)",
      required: false,
    },
  ],
  effect: "blur",
});const { define } = require("../../../plugin");

module.exports = define({
  name: ["blur"],
  category: "images",
  help: "Blur an image",
  options: Array.isArray(__orig.options) ? __orig.options : [],
  run: async (ctx) => __orig.execute.call(__orig, ctx.interaction),
});
