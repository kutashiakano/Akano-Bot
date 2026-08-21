const { downloadMedia } = require("./index");


const { define } = require("../../../plugin");

module.exports = define({
  name: ["instagram", "igdl"],
  category: "downloader",
  help: "Download Instagram post, reel, or carousel",

  run: async (ctx) => {

    if (!args) {
      return ctx.reply("Usage: /instagram <url> [--audio]");
    }
    const isAudio = /--audio|--mp3|--music/.test(args);
    const url = args.replace(/\s*(?:--audio|--mp3|--music)\s*/i, "").trim();
    const match = url.match(/https?:\/\/[^\s]+/i);
    const cleanUrl = match ? match[0].replace(/[.,!?;:]+$/, "") : null;
    if (!cleanUrl) return ctx.reply("Please provide a valid Instagram URL");
    await downloadMedia(ctx, cleanUrl, isAudio);
  
  },
});
