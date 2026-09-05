function escapeMarkdown(text) {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

function splitMessage(text, maxLength) {
  if (text.length <= maxLength) return [ text ];
  const parts = [];
  while (text.length > 0) {
    parts.push(text.slice(0, maxLength));
    text = text.slice(maxLength);
  }
  return parts;
}

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "lyrics", "lirik" ],
  category: "tools",
  help: "Find song lyrics",
  run: async ctx => {
    const args = ctx.text || "";
    if (!args) {
      return ctx.reply(global.settings.message.needLyrics);
    }
    try {
      const lyricsScraper = global.scraper.lyrics;
      if (!lyricsScraper) throw new Error("Lyrics module not available");
      await (ctx.replyWithChatAction ? ctx.replyWithChatAction("typing") : ctx.api?.sendChatAction(ctx.chat?.id, "typing")).catch(() => {});
      const result = await lyricsScraper.getLyrics(args.trim());
      if (!result || !result.lyrics) {
        return ctx.reply(global.settings.message.noLyrics.replace("{query}", args.trim()));
      }
      const chunks = splitMessage(result.lyrics, 3900);
      await ctx.reply(`*${escapeMarkdown(result.title)}*\n_By ${escapeMarkdown(result.artist)} (${result.source})_\n\n${chunks[0]}`);
      for (const chunk of chunks.slice(1)) {
        await ctx.reply(chunk).catch(() => {});
      }
    } catch (e) {
      console.error("[Lyrics TG]", e.message);
      await ctx.reply(global.settings.message.lyricsFailed);
    }
  }
});