const { downloadMedia } = require("./index");


const { define } = require("../../../plugin");

module.exports = define({
  name: ["facebook", "fbdl"],
  category: "downloader",
  help: "Download Facebook video",

  run: async (ctx) => {

    if (!args) {
      return ctx.reply("Usage: /facebook <url>");
    }
    const match = args.match(/https?:\/\/[^\s]+/i);
    const cleanUrl = match ? match[0].replace(/[.,!?;:]+$/, "") : null;
    if (!cleanUrl) return ctx.reply("Please provide a valid Facebook URL");
    await downloadMedia(ctx, cleanUrl, false);
  
  },
});
