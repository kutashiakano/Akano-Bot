const __orig = {
  reg: true,
  help: ["lyrics", "lirik"],
  command: ["lyrics", "lirik"],
  tags: ["tools"],
  run: async (m, { sock, text, usedPrefix }) => {
    if (!text) {
      return m.reply(
        `*Lyrics*\n\nUsage: ${usedPrefix}lyrics <song title>\nExample: ${usedPrefix}lyrics never gonna give you up`,
      );
    }
    try {
      const lyricsScraper = global.scraper.lyrics;
      if (!lyricsScraper) throw new Error("Lyrics module not available");
      await m.reply("🕒 Fetching lyrics...");
      const result = await lyricsScraper.getLyrics(text.trim());
      if (!result || !result.lyrics) {
        return m.reply(`No lyrics found for *${text.trim()}*.`);
      }
      const dot = global.settings.dot || "•";
      const head = `*${result.title}*\n${dot} Artist: ${result.artist}\n${dot} Source: ${result.source}\n\n`;
      if (head.length + result.lyrics.length > 4000) {
        const parts = (head + result.lyrics).match(/[\s\S]{1,4000}/g) || [];
        for (const part of parts) {
          await sock.sendMessage(m.chat, { text: part }, { quoted: m });
        }
      } else {
        await m.reply(head + result.lyrics);
        if (result.thumbnail) {
          await sock
            .sendMessage(m.chat, { image: { url: result.thumbnail } }, { quoted: m })
            .catch(() => {});
        }
      }
    } catch (e) {
      console.error("[Lyrics WA]", e.message);
      await m.reply("Could not fetch lyrics. Please try again.");
    }
  },
  example: "%cmd never gonna give you up",
}
const { define } = require("../../../plugin");

module.exports = define({
  name: ["lyrics", "lirik"],
  category: (["tools"])[0] || "tools",
  help: (["lyrics", "lirik"])[0] || "",
  reg: true,
  example: "%cmd never gonna give you up",
  run: async function (c) { return __orig.run.call(__orig, c.m, c.props); },
});
