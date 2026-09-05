const fs = require("fs/promises");
const path = require("path");
const {downloadStatus: downloadStatus} = require("../../lib/utils");

const __orig = {
  reg: true,
  help: [ "twitter", "xdl" ],
  command: [ "twitter", "xdl" ],
  tags: [ "downloader" ],
  run: async (m, {sock: sock, text: text}) => {
    const isAudio = /--audio|--mp3|--music/.test(text);
    const cleanText = text.replace(/\s*(?:--audio|--mp3|--music)\s*/i, "").trim();
    const match = cleanText?.match(/https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[^\s]+/i);
    const cleanUrl = match ? match[0].replace(/[.,!?;:]+$/, "") : null;
    if (!cleanUrl) throw new Error("Please provide a valid Twitter/X URL.");
    const status = await downloadStatus(m, sock);
    try {
      await status.processing();
      const downloader = global.scraper.ytdpl;
      const metadata = await downloader.getMetadata(cleanUrl);
      const isGallery = Array.isArray(metadata);
      if (isGallery) {
        const result = await downloader.download(cleanUrl);
        const medias = [];
        const audioFiles = [];
        for (const file of result.files) {
          const ext = path.extname(file).toLowerCase();
          const isAudioFile = [ ".mp3", ".m4a", ".opus", ".wav" ].includes(ext);
          if (isAudio && isAudioFile) {
            const stat = await fs.stat(file);
            const maxSize = (global.settings.max_uploud || 50) * 1024 * 1024;
            if (stat.size <= maxSize) audioFiles.push(file);
          } else if (!isAudio && !isAudioFile) {
            const stat = await fs.stat(file);
            const maxSize = (global.settings.max_uploud || 50) * 1024 * 1024;
            if (stat.size <= maxSize) {
              const type = [ ".mp4", ".webm", ".mov" ].includes(ext) ? "video" : "image";
              medias.push({
                type: type,
                data: {
                  url: file
                }
              });
            }
          }
        }
        if (isAudio && audioFiles.length > 0) {
          for (const file of audioFiles) {
            await sock.sendFile(m.chat, file, path.basename(file), "*Twitter/X Audio*", m);
          }
        } else if (!isAudio && medias.length > 0) {
          if (medias.length > 1) {
            await sock.sndAlb(m.chat, medias, {
              quoted: m,
              caption: `*Twitter/X Carousel* — ${medias.length} media`
            });
          } else {
            await sock.sendFile(m.chat, medias[0].data.url, path.basename(medias[0].data.url), "*Twitter/X Media*", m);
          }
        } else {
          throw new Error(`Failed to download Twitter/X ${isAudio ? "audio" : "media"}.`);
        }
        await downloader.cleanup(result.directory);
      } else {
        const payload = {
          title: metadata.title || metadata.id || "Unknown",
          uploader: metadata.uploader || metadata.channel || "Unknown",
          duration: metadata.duration || 0
        };
        const dot = global.settings.dot || "•";
        const type = isAudio ? "Audio" : "Video";
        const caption = `*Twitter/X ${type} Download*\n${dot} Title: ${payload.title}\n${dot} Author: ${payload.uploader}\n${dot} Duration: ${Math.floor(payload.duration)}s`;
        const result = await downloader.download(cleanUrl);
        const file = result.files[0];
        if (!file) throw new Error(`Failed to download Twitter/X ${type.toLowerCase()}.`);
        const stat = await fs.stat(file);
        const maxSize = (global.settings.max_uploud || 50) * 1024 * 1024;
        if (stat.size > maxSize) {
          await downloader.cleanup(result.directory);
          throw new Error("File size exceeds the maximum limit.");
        }
        await sock.sendFile(m.chat, file, path.basename(file), caption, m);
        await downloader.cleanup(result.directory);
      }
      await status.success();
    } catch (e) {
      await status.failed(e);
    }
  },
  example: "%cmd https://x.com/user/status/1234567890\n%cmd https://x.com/user/status/1234567890 --audio"
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "twitter", "xdl" ],
  category: "downloader",
  help: [ "twitter", "xdl" ][0] || "",
  reg: true,
  example: "%cmd https://x.com/user/status/1234567890\n%cmd https://x.com/user/status/1234567890 --audio",
  run: async function(c) {
    return __orig.run.call(__orig, c.m, c.props);
  }
});