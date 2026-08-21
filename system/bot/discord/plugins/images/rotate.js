const { mkImgCmd } = require("./command");

const __orig = mkImgCmd({
  name: "rotate",
  description: "Rotate an image by degrees",
  options: [
    {
      name: "amount",
      type: 3,
      description: "Rotation degrees (default 90)",
      required: false,
    },
  ],
  effect: "rotate",
});const { define } = require("../../../plugin");

module.exports = define({
  name: ["rotate"],
  category: "images",
  help: "Rotate an image by degrees",
  options: Array.isArray(__orig.options) ? __orig.options : [],
  run: async (ctx) => __orig.execute.call(__orig, ctx.interaction),
});
