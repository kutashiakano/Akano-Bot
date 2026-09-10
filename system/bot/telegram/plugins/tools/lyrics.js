function escapeHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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

const { define: define } = require("../../../sdk");

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
      await ctx.reply(`<b>${escapeHtml(result.title)}</b>\n<i>By ${escapeHtml(result.artist)} (${escapeHtml(result.source)})</i>\n\n${escapeHtml(chunks[0])}`, { parse_mode: "HTML" });
      for (const chunk of chunks.slice(1)) {
        await ctx.reply(escapeHtml(chunk), { parse_mode: "HTML" }).catch(() => {});
      }
    } catch (e) {
      console.error("[Lyrics TG]", e.message);
      await ctx.reply(global.settings.message.lyricsFailed);
    }
  }
});