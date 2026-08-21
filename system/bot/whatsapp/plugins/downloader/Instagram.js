const fs = require("fs/promises");
const path = require("path");
const { downloadStatus } = require("../../lib/utils");

const cookiePath = path.join(__dirname, "../../../../../cookies.txt");

const __orig = {
  reg: true,
  help: ["instagram", "igdl"],
  command: ["instagram", "igdl"],
  tags: ["downloader"],
  run: async (m, { sock, text }) => {
    const isAudio = /--audio|--mp3|--music/.test(text);
    const cleanText = text.replace(/\s*(?:--audio|--mp3|--music)\s*/i, "").trim();

    const match = cleanText?.match(/https?:\/\/(?:www\.)?instagram\.com\/[^\s]+/i);
    const cleanUrl = match ? match[0].replace(/[.,!?;:]+$/, "") : null;
    if (!cleanUrl) throw new Error("Please provide a valid Instagram URL.");

    const status = await downloadStatus(m, sock);

    try {
      await status.processing();

      const downloader = global.scraper.ytdpl;
      const metadata = await downloader.getMetadata(cleanUrl, { cookies: cookiePath });
      const isGallery = Array.isArray(metadata);

      if (isGallery) {
        const result = await downloader.download(cleanUrl, { cookies: cookiePath });
        const medias = [];
        const audioFiles = [];

        for (const file of result.files) {
          const ext = path.extname(file).toLowerCase();
          const isAudioFile = [".mp3", ".m4a", ".opus", ".wav"].includes(ext);

          const stat = await fs.stat(file);
          const maxSize = (global.settings.max_uploud || 50) * 1024 * 1024;

          if (isAudio && isAudioFile && stat.size <= maxSize) {
            audioFiles.push(file);
          } else if (!isAudio && !isAudioFile && stat.size <= maxSize) {
            const type = [".mp4", ".webm", ".mov"].includes(ext) ? "video" : "image";
            medias.push({ type, data: { url: file } });
          }
        }

        const author =
          metadata[0]?.uploader || metadata[0]?.channel || metadata[0]?.creator || "Unknown";
        const albumCaption = `*Instagram ${isAudio ? "Audio" : "Carousel"}*\n${global.settings.dot} Total: ${isAudio ? audioFiles.length + " audios" : medias.length + " slides"}\n${global.settings.dot} Author: ${author}`;

        if (isAudio && audioFiles.length > 0) {
          for (const file of audioFiles) {
            await sock.sendFile(m.chat, file, path.basename(file), "*Instagram Audio*", m);
          }
        } else if (!isAudio && medias.length > 0) {
          if (medias.length > 1) {
            await sock.sndAlb(m.chat, medias, { quoted: m, caption: albumCaption });
          } else {
            await sock.sendFile(
              m.chat,
              medias[0].data.url,
              path.basename(medias[0].data.url),
              albumCaption,
              m,
            );
          }
        } else {
          throw new Error(
            `Failed to download Instagram ${isAudio ? "audio" : "carousel"} - no valid files.`,
          );
        }

        await downloader.cleanup(result.directory);
      } else {
        const payload = {
          title: metadata.title || metadata.id || "Unknown",
          uploader: metadata.uploader || metadata.channel || metadata.creator || "Unknown",
          duration: metadata.duration || 0,
        };

        const dot = global.settings.dot || "•";
        const type = isAudio ? "Audio" : "Media";
        const caption = `*Instagram ${type} Download*\n${dot} Title: ${payload.title}\n${dot} Author: ${payload.uploader}\n${dot} Duration: ${Math.floor(payload.duration)}s`;

        const result = await downloader.download(cleanUrl, { cookies: cookiePath });
        const file = result.files[0];

        if (!file) throw new Error(`Failed to download Instagram ${type.toLowerCase()}.`);

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
  example:
    "%cmd https://www.instagram.com/p/example\n%cmd https://www.instagram.com/p/example --audio",
}
const { define } = require("../../../plugin");

module.exports = define({
  name: ["instagram", "igdl"],
  category: (["downloader"])[0] || "tools",
  help: (["instagram", "igdl"])[0] || "",
  reg: true,
  example: "%cmd https://www.instagram.com/p/example\n%cmd https://www.instagram.com/p/example --audio",
  run: async function (c) { return __orig.run.call(__orig, c.m, c.props); },
});
