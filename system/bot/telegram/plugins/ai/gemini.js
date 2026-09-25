import sdkFacade from "../../../sdk/index.js";
import { text as sdkText, telegram as tgsdk } from "@kutashiakanocanzy/sdk";

const { define } = sdkFacade;
const sanitizeMd = sdkText.sanitize;
const splitSmart = sdkText.splitSmart;
const stripMd = sdkText.stripMd;

const cooldowns = new Map;
const COOLDOWN_MS = 5e3;

async function sendRichReply(ctx, text) {
  const plain = stripMd(sanitizeMd(text));
  const chunks = splitSmart(plain, 3900);
  const replyParam = ctx.message ? {
    reply_parameters: {
      message_id: ctx.message.message_id
    }
  } : {};
  for (const ch of chunks) {
    await ctx.reply(ch, replyParam);
  }
}

async function handleRun(ctx, args) {
  const text = args?.trim();
  if (!text) return ctx.reply(global.settings.message.needQuestion);
  const userId = String(ctx.from?.id);
  const now = Date.now();
  const lastUsed = cooldowns.get(userId) || 0;
  if (now - lastUsed < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - lastUsed)) / 1e3);
    return ctx.reply(global.settings.message.cooldownWait.replace("{seconds}", wait));
  }
  cooldowns.set(userId, now);
  let placeholder = null;
  let busy = false;
  try {
    const gemini = global.scraper.gemini;
    if (!gemini) throw new Error("Gemini module not available.");
    await tgsdk.presence(ctx, "typing");
    try {
      placeholder = await ctx.reply("Generating...");
    } catch {
      placeholder = null;
    }
    let acc = "";
    let lastEdit = 0;
    let lastSent = "";
    const onChunk = async chunk => {
      acc += chunk;
      if (busy) return;
      if (Date.now() - lastEdit < 1500) return;
      lastEdit = Date.now();
      const partial = stripMd(sanitizeMd(acc)).slice(0, 3800);
      if (partial === lastSent || partial.length < 20) return;
      lastSent = partial;
      if (!placeholder) return;
      busy = true;
      try {
        await placeholder.editText(partial);
      } catch {} finally {
        busy = false;
      }
    };
    const response = await gemini.chat(text, userId, onChunk);
    const finalText = response && response.text ? response.text : acc;
    if (!finalText) throw new Error("Empty response from Gemini.");
    if (placeholder) {
      try {
        await placeholder.delete().catch(() => {});
      } catch {}
    }
    await sendRichReply(ctx, finalText);
  } catch (e) {
    console.error("[Gemini TG]", e.message);
    if (placeholder) {
      try {
        await placeholder.delete().catch(() => {});
      } catch {}
    }
    if (e.message && e.message.includes("Header overflow")) {
      const gemini = global.scraper.gemini;
      if (gemini) gemini.clearSession(userId);
    }
    await ctx.reply(global.settings.message.geminiUnavailable);
  }
}

export default define({
  name: [ "gemini" ],
  category: "ai",
  help: "Chat with Gemini AI",
  run: async c => handleRun(c.ctx, typeof c.text === "string" ? c.text : (c.args || []).join(" "))
});
