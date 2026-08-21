const cooldowns = new Map();
const COOLDOWN_MS = 5000;

function escapeMarkdown(text) {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, "\\$&");
}

const __orig = {
  command: ["gemini", "new_session", "del_session"],
  help: "Chat with Gemini AI | /new_session - Reset | /del_session - Delete",
  tags: ["ai"],
  before: async (ctx, extra) => {
    if (!ctx.inlineQuery) return false;
    const query = ctx.inlineQuery.query?.trim();
    if (!query) {
      await ctx.answerInlineQuery(
        [
          {
            type: "article",
            id: "help",
            title: "Ask Gemini AI",
            description: "Type a question after @botusername",
            input_message_content: { message_text: "Usage: @botusername <your question>" },
          },
        ],
        { cache_time: 0 },
      );
      return true;
    }
    try {
      const gemini = global.scraper.gemini;
      if (!gemini) throw new Error("Gemini module not available.");
      const userId = String(ctx.from?.id);
      const response = await gemini.chat(query, userId);
      if (!response || !response.text) throw new Error("Empty response from Gemini.");
      const clean = escapeMarkdown(response.text);
      const preview = clean.length > 200 ? clean.slice(0, 197) + "..." : clean;
      await ctx.answerInlineQuery(
        [
          {
            type: "article",
            id: "gemini_result",
            title: "Gemini AI Answer",
            description: preview,
            input_message_content: {
              message_text: `*Q:* ${escapeMarkdown(query)}\n\n${clean}`,
              parse_mode: "Markdown",
            },
          },
        ],
        { cache_time: 0 },
      );
    } catch (e) {
      if (e.message && e.message.includes("Header overflow")) {
        const gemini = global.scraper.gemini;
        if (gemini) gemini.clearSession(String(ctx.from?.id));
      }
      await ctx.answerInlineQuery(
        [
          {
            type: "article",
            id: "error",
            title: "Gemini Unavailable",
            description: "Could not get a response.",
            input_message_content: { message_text: "Gemini is currently unavailable." },
          },
        ],
        { cache_time: 0 },
      );
    }
    return true;
  },
  run: async (ctx, args) => {
    const cmd = ctx.message?.text?.split(" ")[0].replace("/", "").toLowerCase();
    const text = args?.trim();

    if (cmd === "new_session" || cmd === "newsession") {
      const gemini = global.scraper.gemini;
      if (gemini) gemini.clearSession(String(ctx.from?.id));
      return ctx.reply("New session started.");
    }

    if (cmd === "del_session" || cmd === "delsession") {
      const gemini = global.scraper.gemini;
      if (gemini) gemini.clearSession(String(ctx.from?.id));
      return ctx.reply("Session deleted.");
    }

    if (!text) {
      return ctx.reply("Please provide a question.\nExample: /gemini what is quantum computing?");
    }

    const userId = String(ctx.from?.id);
    const now = Date.now();
    const lastUsed = cooldowns.get(userId) || 0;
    if (now - lastUsed < COOLDOWN_MS) {
      const wait = Math.ceil((COOLDOWN_MS - (now - lastUsed)) / 1000);
      return ctx.reply(`Please wait ${wait}s before using this command again.`);
    }
    cooldowns.set(userId, now);

    try {
      const gemini = global.scraper.gemini;
      if (!gemini) throw new Error("Gemini module not available.");
      await ctx.chatAct("typing").catch(() => {});
      const response = await gemini.chat(text, userId);
      if (!response || !response.text) throw new Error("Empty response from Gemini.");
      await ctx
        .reply(escapeMarkdown(response.text), { parse_mode: "Markdown" })
        .catch(() => ctx.reply(response.text));
    } catch (e) {
      console.error("[Gemini TG]", e.message);
      if (e.message && e.message.includes("Header overflow")) {
        const gemini = global.scraper.gemini;
        if (gemini) gemini.clearSession(userId);
      }
      await ctx.reply("Gemini is currently unavailable. Please try again later.");
    }
  },
}
const { define } = require("../../plugin");

module.exports = define({
  name: ["gemini", "new_session", "del_session"],
  category: (["ai"])[0] || "general",
  help: "Chat with Gemini AI | /new_session - Reset | /del_session - Delete",
  before: async (ctx, extra) => {
    if (!ctx.inlineQuery) return false;
    const query = ctx.inlineQuery.query?.trim();
    if (!query) {
      await ctx.answerInlineQuery(
        [
          {
            type: "article",
            id: "help",
            title: "Ask Gemini AI",
            description: "Type a question after @botusername",
            input_message_content: { message_text: "Usage: @botusername <your question>" },
          },
        ],
        { cache_time: 0 },
      );
      return true;
    }
    try {
      const gemini = global.scraper.gemini;
      if (!gemini) throw new Error("Gemini module not available.");
      const userId = String(ctx.from?.id);
      const response = await gemini.chat(query, userId);
      if (!response || !response.text) throw new Error("Empty response from Gemini.");
      const clean = escapeMarkdown(response.text);
      const preview = clean.length > 200 ? clean.slice(0, 197) + "..." : clean;
      await ctx.answerInlineQuery(
        [
          {
            type: "article",
            id: "gemini_result",
            title: "Gemini AI Answer",
            description: preview,
            input_message_content: {
              message_text: `*Q:* ${escapeMarkdown(query)}\n\n${clean}`,
              parse_mode: "Markdown",
            },
          },
        ],
        { cache_time: 0 },
      );
    } catch (e) {
      if (e.message && e.message.includes("Header overflow")) {
        const gemini = global.scraper.gemini;
        if (gemini) gemini.clearSession(String(ctx.from?.id));
      }
      await ctx.answerInlineQuery(
        [
          {
            type: "article",
            id: "error",
            title: "Gemini Unavailable",
            description: "Could not get a response.",
            input_message_content: { message_text: "Gemini is currently unavailable." },
          },
        ],
        { cache_time: 0 },
      );
    }
    return true;
  },
  run: async function (c) { return __orig.run(c.ctx, c.args); },
});
