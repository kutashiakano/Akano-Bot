const fs = require("fs/promises");
const path = require("path");
const { downloadStatus } = require("../../lib/utils");

module.exports = {
  help: ["pinterest", "pindl"],
  command: ["pinterest", "pindl"],
  tags: ["downloader"],
  run: async (m, { sock, text }) => {
    const isAudio = /--audio|--mp3|--music/.test(text);
    const cleanText = text.replace(/\s*(?:--audio|--mp3|--music)\s*/i, "").trim();

    const match = cleanText?.match(/https?:\/\/(?:www\.)?(?:pinterest\.com|pin\.it)\/[^\s]+/i);
    const cleanUrl = match ? match[0].replace(/[.,!?;:]+$/, "") : null;
    if (!cleanUrl) throw new Error("Please provide a valid Pinterest URL.");

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

        if (isAudio && audioFiles.length > 0) {
          for (const file of audioFiles) {
            await sock.sendFile(m.chat, file, path.basename(file), "*Pinterest Audio*", m);
          }
        } else if (!isAudio && medias.length > 0) {
          if (medias.length > 1) {
            await sock.sendAlbumMessage(m.chat, medias, { quoted: m, caption: `*Pinterest Carousel* — ${medias.length} pins` });
          } else {
            await sock.sendFile(m.chat, medias[0].data.url, path.basename(medias[0].data.url), "*Pinterest Pin*", m);
          }
        } else {
          throw new Error(`Failed to download Pinterest ${isAudio ? "audio" : "media"}.`);
        }

        await downloader.cleanup(result.directory);
      } else {
        const result = await downloader.download(cleanUrl);
        const file = result.files[0];

        if (!file) throw new Error(`Failed to download Pinterest ${isAudio ? "audio" : "media"}.`);

        const stat = await fs.stat(file);
        const maxSize = (global.settings.max_uploud || 50) * 1024 * 1024;
        if (stat.size > maxSize) {
          await downloader.cleanup(result.directory);
          throw new Error("File size exceeds the maximum limit.");
        }

        await sock.sendFile(m.chat, file, path.basename(file), `*Pinterest ${isAudio ? "Audio" : "Pin"}*`, m);
        await downloader.cleanup(result.directory);
      }

      await status.success();
    } catch (e) {
      await status.failed(e);
    }
  },
  example: "%cmd https://www.pinterest.com/pin/1234567890\n%cmd https://www.pinterest.com/pin/1234567890 --audio",
};