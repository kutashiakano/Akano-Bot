const { downloadMedia } = require("./index");


const { define } = require("../../../plugin");

module.exports = define({
  name: ["twitter", "xdl", "x"],
  category: "downloader",
  help: "Download Twitter/X video or photos",

  run: async (ctx) => {

    if (!args) {
      return ctx.reply("Usage: /twitter <url>");
    }
    const match = args.match(/https?:\/\/[^\s]+/i);
    const cleanUrl = match ? match[0].replace(/[.,!?;:]+$/, "") : null;
    if (!cleanUrl) return ctx.reply("Please provide a valid Twitter/X URL");
    await downloadMedia(ctx, cleanUrl, false);
  
  },
});
