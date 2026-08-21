const fs = require("fs/promises");
const path = require("path");
const { downloadStatus } = require("../../lib/utils");

const __orig = {
  reg: true,
  help: ["spotify", "spdl", "spotifydl"],
  command: ["spotify", "spdl", "spotifydl"],
  tags: ["downloader"],
  run: async (m, { sock, text }) => {
    if (!text) {
      throw new Error(
        "Please provide a Spotify link or song title.\n\n" +
          "Example:\n" +
          "spotify never gonna give you up\n" +
          "spotify https://open.spotify.com/track/xxxxx",
      );
    }

    const status = await downloadStatus(m, sock);

    try {
      const spotify = global.scraper.spotify;
      if (!spotify) throw new Error("Spotify module not available");

      const query = text.trim();
      const isUrl = /open\.spotify\.com\/(track|album|playlist)|spotify\.link\//i.test(query);

      await status.processing();

      let track;
      if (isUrl) {
        if (/open\.spotify\.com\/(album|playlist)/i.test(query)) {
          const tracks = await spotify.getPlaylist(query);
          if (!tracks.length) throw new Error("No tracks found in this Spotify link");
          track = tracks[0];
          for (const t of tracks.slice(1, 6)) {
            try {
              const res = await spotify.download(t.url);
              const file = res.files[0];
              const stat = await fs.stat(file);
              const maxSize = (global.settings.max_uploud || 50) * 1024 * 1024;
              if (stat.size > maxSize) {
                await spotify.cleanup(res.directory);
                continue;
              }
              await sock.sendFile(
                m.chat,
                file,
                path.basename(file),
                `*Spotify*\n${t.title}\nBy: ${t.uploader}`,
                m,
              );
              await spotify.cleanup(res.directory);
            } catch (e) {}
          }
        } else {
          track = await spotify.getTrack(query);
        }
      } else {
        const results = await spotify.search(query, 1);
        if (!results.length) throw new Error("No results found on Spotify");
        track = results[0];
      }

      const res = await spotify.download(track.url);
      const file = res.files[0];
      const stat = await fs.stat(file);
      const maxSize = (global.settings.max_uploud || 50) * 1024 * 1024;

      if (stat.size > maxSize) {
        await spotify.cleanup(res.directory);
        throw new Error("File size exceeds the maximum limit.");
      }

      const dot = global.settings.dot || "•";
      const caption = `*Spotify Track*\n${dot} Title: ${track.title}\n${dot} Artist: ${track.uploader}\n${dot} Album: ${track.album || "-"}\n${dot} Duration: ${track.durationLabel || track.duration + "s"}`;

      await sock.sendFile(m.chat, file, path.basename(file), caption, m);
      await spotify.cleanup(res.directory);
      await status.success();
    } catch (e) {
      await status.failed(e);
    }
  },
  example: "%cmd never gonna give you up\n%cmd https://open.spotify.com/track/example",
}
const { define } = require("../../../plugin");

module.exports = define({
  name: ["spotify", "spdl", "spotifydl"],
  category: (["downloader"])[0] || "tools",
  help: (["spotify", "spdl", "spotifydl"])[0] || "",
  reg: true,
  example: "%cmd never gonna give you up\n%cmd https://open.spotify.com/track/example",
  run: async function (c) { return __orig.run.call(__orig, c.m, c.props); },
});
