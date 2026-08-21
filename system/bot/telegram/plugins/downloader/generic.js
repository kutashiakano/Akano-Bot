const { downloadMedia, detectSource } = require("./index");


const { define } = require("../../../plugin");

module.exports = define({
  name: ["download", "dl"],
  category: "downloader",
  help: "Download media from any supported platform",

  run: async (ctx) => {

    if (!args) {
      return ctx.reply(
        "Usage:\n" +
          "/dl <url> - Download video/photo\n" +
          "/dl <url> --audio - Download as audio (MP3)\n\n" +
          "Supported Platforms:\n" +
          "YouTube (video, shorts, music)\n" +
          "TikTok (video, slides/photos)\n" +
          "Instagram (post, reel, carousel)\n" +
          "Twitter/X (video, photos)\n" +
          "Facebook (video)\n" +
          "Spotify (track)\n\n" +
          "Examples:\n" +
          "/dl https://youtu.be/xxxxx\n" +
          "/dl https://www.tiktok.com/@user/video/xxxxx\n" +
          "/dl https://www.instagram.com/p/xxxxx\n" +
          "/dl https://open.spotify.com/track/xxxxx --audio",
      );
    }

    const isAudio = /--audio|--mp3|--music/.test(args);
    const url = args.replace(/\s*(?:--audio|--mp3|--music)\s*/i, "").trim();

    const match = url.match(/https?:\/\/[^\s]+/i);
    const cleanUrl = match ? match[0].replace(/[.,!?;:]+$/, "") : null;

    if (!cleanUrl) {
      return ctx.reply("Please provide a valid URL");
    }

    await downloadMedia(ctx, cleanUrl, isAudio);
  
  },
});
