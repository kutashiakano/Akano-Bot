const fs = require("fs/promises");
const path = require("path");
const { downloadStatus } = require("../../lib/utils");

const __orig = {
  reg: true,
  help: ["facebook", "fbdl"],
  command: ["facebook", "fbdl"],
  tags: ["downloader"],
  run: async (m, { sock, text }) => {
    const isAudio = /--audio|--mp3|--music/.test(text);
    const cleanText = text.replace(/\s*(?:--audio|--mp3|--music)\s*/i, "").trim();

    const match = cleanText?.match(/https?:\/\/(?:www\.)?(?:facebook\.com|fb\.watch)\/[^\s]+/i);
    const cleanUrl = match ? match[0].replace(/[.,!?;:]+$/, "") : null;
    if (!cleanUrl) throw new Error("Please provide a valid Facebook URL.");

    const status = await downloadStatus(m, sock);

    try {
      await status.processing();

      const downloader = global.scraper.ytdpl;
      const metadata = await downloader.getMetadata(cleanUrl);

      const payload = {
        title: metadata.title || metadata.id || "Unknown",
        uploader: metadata.uploader || metadata.channel || "Unknown",
        duration: metadata.duration || 0,
      };

      const dot = global.settings.dot || "•";
      const type = isAudio ? "Audio" : "Video";
      const caption = `*Facebook ${type} Download*\n${dot} Title: ${payload.title}\n${dot} Author: ${payload.uploader}\n${dot} Duration: ${Math.floor(payload.duration)}s`;

      const result = await downloader.download(cleanUrl);
      const file = result.files[0];

      if (!file) throw new Error(`Failed to download Facebook ${type.toLowerCase()}.`);

      const stat = await fs.stat(file);
      const maxSize = (global.settings.max_uploud || 50) * 1024 * 1024;
      if (stat.size > maxSize) {
        await downloader.cleanup(result.directory);
        throw new Error("File size exceeds the maximum limit.");
      }

      await sock.sendFile(m.chat, file, path.basename(file), caption, m);
      await downloader.cleanup(result.directory);
      await status.success();
    } catch (e) {
      await status.failed(e);
    }
  },
  example:
    "%cmd https://www.facebook.com/watch/?v=1234567890\n%cmd https://www.facebook.com/watch/?v=1234567890 --audio",
}
const { define } = require("../../../plugin");

module.exports = define({
  name: ["facebook", "fbdl"],
  category: (["downloader"])[0] || "tools",
  help: (["facebook", "fbdl"])[0] || "",
  reg: true,
  example: "%cmd https://www.facebook.com/watch/?v=1234567890\n%cmd https://www.facebook.com/watch/?v=1234567890 --audio",
  run: async function (c) { return __orig.run.call(__orig, c.m, c.props); },
});
