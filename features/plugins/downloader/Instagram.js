module.exports = {
  help: ["igdl", "ig"],
  command: ["igdl", "ig"],
  tags: ["downloader"],
  run: async (m, { sock, text }) => {
    const result = await scraper.Instagram(text);
    const { oversize, size } = await sock.sizeLimit(
      result.url[0],
      global.max_upload,
    );

    if (oversize) {
      return m.reply(
        `File size (${size}) exceeds the maximum limit. Please download it manually: ${result.url[0]}`,
      );
    }

    const caption =
      `${global.settings.dot} Username: @${result.metadata.username || "unknown"}\n` +
      `${global.settings.dot} Likes: ${result.metadata.like >= 0 ? result.metadata.like : "N/A"}\n` +
      `${global.settings.dot} Comments: ${result.metadata.comment || "N/A"}\n` +
      (result.metadata.caption
        ? `${global.settings.dot} Caption: ${result.metadata.caption}\n`
        : "");

    if (result.url.length > 1) {
      const medias = result.url.map((url) => ({
        type: "image",
        data: { url },
      }));
      await sock.sendAlbumMessage(m.chat, medias, { caption });
    } else {
      await sock.sendFile(m.chat, result.url[0], null, caption, m);
    }
  },
  example: "%cmd https://www.instagram.com/p/example",
};
