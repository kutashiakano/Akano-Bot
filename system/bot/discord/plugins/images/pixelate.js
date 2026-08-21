const { mkImgCmd } = require("./command");

const __orig = mkImgCmd({
  name: "pixelate",
  description: "Pixelate an image",
  options: [
    {
      name: "amount",
      type: 4,
      description: "Pixel block size (1-50, default 8)",
      required: false,
    },
  ],
  effect: "pixelate",
});const { define } = require("../../../plugin");

module.exports = define({
  name: ["pixelate"],
  category: "images",
  help: "Pixelate an image",
  options: Array.isArray(__orig.options) ? __orig.options : [],
  run: async (ctx) => __orig.execute.call(__orig, ctx.interaction),
});
