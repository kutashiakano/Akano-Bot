const { mkImgCmd } = require("./command");

const __orig = mkImgCmd({
  name: "meme",
  description: "Add top/bottom captions to an image (meme style)",
  options: [
    {
      name: "top",
      type: 3,
      description: "Top caption text",
      required: false,
    },
    {
      name: "bottom",
      type: 3,
      description: "Bottom caption text",
      required: false,
    },
  ],
  effect: "meme",
});const { define } = require("../../../plugin");

module.exports = define({
  name: ["meme"],
  category: "images",
  help: "Add top/bottom captions to an image (meme style)",
  options: Array.isArray(__orig.options) ? __orig.options : [],
  run: async (ctx) => __orig.execute.call(__orig, ctx.interaction),
});
