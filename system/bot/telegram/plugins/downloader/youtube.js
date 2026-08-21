const { downloadMedia } = require("./index");


const { define } = require("../../../plugin");

module.exports = define({
  name: ["youtube", "ytdl"],
  category: "downloader",
  help: "Download YouTube video, short, or music",

  run: async (ctx) => {

    if (!args) {
      return ctx.reply("Usage: /youtube <url> [--audio]");
    }
    const isAudio = /--audio|--mp3|--music/.test(args);
    const url = args.replace(/\s*(?:--audio|--mp3|--music)\s*/i, "").trim();
    const match = url.match(/https?:\/\/[^\s]+/i);
    const cleanUrl = match ? match[0].replace(/[.,!?;:]+$/, "") : null;
    if (!cleanUrl) return ctx.reply("Please provide a valid YouTube URL");
    await downloadMedia(ctx, cleanUrl, isAudio);
  
  },
});
