const {downloadMedia: downloadMedia, detectSource: detectSource} = require("../_lib/downloader");
const {define: define} = require("../../../plugin");

let _udl = null;
try { _udl = require("../../../../scrapers/src/unified-downloader"); } catch {}
module.exports = define({
  name: [ "dl" ],
  category: "downloader",
  help: "Download video or audio from YouTube, TikTok, Instagram, Twitter/X, Facebook (yt-dlp 1752 extractors, supports ALL yt-dlp flags)",
  run: async ctx => {
    const args = ctx.text || "";
    if (!args) {
      const supported = (_udl && _udl.getSupportedProviders) ? _udl.getSupportedProviders().slice(0,12).map(p=> `${p.name} (${p.domains[0]})`) : [ "YouTube (video, shorts, music)", "TikTok (video, slides)", "Instagram (post, reel, carousel)", "Twitter/X (video, photos)", "Facebook (video)", "SoundCloud", "Pinterest", "Reddit", "Twitch", "Vimeo", "Dailymotion", "Generic (any of 1752 yt-dlp sites)" ];
      return ctx.reply("Usage:\n" + "/dl <url> - Download video/photo\n" + "/dl <url> --audio - Download as audio\n" + "/dl <url> --audio-format mp3 --embed-thumbnail\n" + "/dl <url> --write-subs --sub-langs en --convert-subs srt\n" + "/dl <url> --format \"bv*+ba/b\" --format-sort \"res:720\" --download-sections \"*0:30-1:00\"\n\n" + "Supported platforms (1752 extractors via yt-dlp):\n" + supported.map(s => "- " + s).join("\n") + "\n\nExamples:\n" + "/dl https://youtu.be/xxxxx\n" + "/dl https://vt.tiktok.com/xxxxx --audio\n" + "/dl https://soundcloud.com/artist/track --audio --audio-format opus");
    }

    let cleanUrl = null;
    let opts = {};
    if (_udl && typeof _udl.parseCliFlags === "function") {
      const urlMatch = args.match(/https?:\/\/[^\s]+/i);
      if (urlMatch) {
        cleanUrl = urlMatch[0].replace(/[.,!?;:]+$/, "");
        const after = args.slice(args.indexOf(urlMatch[0]) + urlMatch[0].length).trim();
        if (after) opts = _udl.parseCliFlags(after);
        else {

          const before = args.slice(0, args.indexOf(urlMatch[0])).trim();
          if (before && /--/.test(before)) Object.assign(opts, _udl.parseCliFlags(before));
        }

        if (/--audio|--mp3|--music/.test(args) && !opts.audioOnly) opts.audioOnly = true;
      } else {
        cleanUrl = null;
      }
    } else {
      const isAudio = /--audio|--mp3|--music/.test(args);
      const url = args.replace(/\s*(?:--audio|--mp3|--music)\s*/i, "").trim();
      const match = url.match(/https?:\/\/[^\s]+/i);
      cleanUrl = match ? match[0].replace(/[.,!?;:]+$/, "") : null;
      opts = isAudio ? { audioOnly:true } : {};
    }
    if (!cleanUrl) {
      return ctx.reply(global.settings.message.needUrl);
    }

    await downloadMedia(ctx, cleanUrl, opts);
  }
});