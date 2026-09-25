import sdkFacade from "../../../sdk/index.js";
import { telegram as tgsdk } from "@kutashiakanocanzy/sdk";

const { define } = sdkFacade;

export default define({
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
      await tgsdk.typing(ctx);
      const result = await lyricsScraper.getLyrics(args.trim());
      if (!result || !result.lyrics) {
        return ctx.reply(global.settings.message.noLyrics.replace("{query}", args.trim()));
      }
      const chunks = tgsdk.chop(result.lyrics, 3900);
      await ctx.reply(`<b>${tgsdk.Esc(result.title)}</b>\n<i>By ${tgsdk.Esc(result.artist)} (${tgsdk.Esc(result.source)})</i>\n\n${tgsdk.Esc(chunks[0])}`, { parse_mode: "HTML" });
      for (const chunk of chunks.slice(1)) {
        await ctx.reply(tgsdk.Esc(chunk), { parse_mode: "HTML" }).catch(() => {});
      }
    } catch (e) {
      console.error("[Lyrics TG]", e.message);
      await ctx.reply(global.settings.message.lyricsFailed);
    }
  }
});
