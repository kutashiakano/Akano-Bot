const {define: define} = require("../../../plugin");

const cooldowns = new Map;

const COOLDOWN_MS = 5e3;

const GEMINI_THUMB = "https://raw.githubusercontent.com/lobehub/lobe-icons/refs/heads/master/packages/static-png/dark/gemini-color.png";

function escapeMarkdown(text) {
  return String(text ?? "").replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, "\\$&");
}

function mdToV2(src) {
  const lines = String(src ?? "").split("\n");
  const out = [];
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      out.push("```");
      continue;
    }
    if (inFence) {
      out.push(line.replace(/[`\\]/g, "\\$&"));
      continue;
    }
    if (/^\s*([-_*]\s*){3,}$/.test(line)) {
      out.push("━".repeat(16));
      continue;
    }
    const isTableRow = s => s.includes("|") && s.trim().length > 0;
    const isSepRow = s => /^\s*\|?[\s:\-|]+\|?[\s]*$/.test(s) && s.includes("---");
    if (isTableRow(line) && isSepRow(lines[i + 1] || "")) {
      const parseCells = s => {
        let parts = s.split("|").map(c => c.trim());
        if (parts[0] === "") parts = parts.slice(1);
        if (parts[parts.length - 1] === "") parts = parts.slice(0, -1);
        return parts;
      };
      const hdr = parseCells(line).filter(Boolean);
      let tbl = `*${hdr.map(c => escapeMarkdown(c)).join(" | ")}*`;
      i += 2;
      while (i < lines.length && isTableRow(lines[i]) && !isSepRow(lines[i])) {
        const cells = parseCells(lines[i]);
        const row = cells.map(c => {
          let r = "";
          let p = 0;
          const rx = /\[([^\]]+)\]\(([^)\s]+)\)|`([^`\n]+)`|\*\*([^*]+?)\*{1,2}|__([^_]+)__|\*([^*\n]+?)\*/g;
          let mm;
          while (mm = rx.exec(c)) {
            r += escapeMarkdown(c.slice(p, mm.index));
            if (mm[1] !== undefined) r += "[" + escapeMarkdown(mm[1]) + "](" + mm[2].replace(/\\/g, "").replace(/\)/g, "\\)") + ")"; else if (mm[3] !== undefined) r += "`" + mm[3].replace(/[`\\]/g, "\\$&") + "`"; else if (mm[4] !== undefined) r += "*" + escapeMarkdown(mm[4]) + "*"; else r += "_" + escapeMarkdown(mm[5] !== undefined ? mm[5] : mm[6]) + "_";
            p = mm.index + mm[0].length;
          }
          r += escapeMarkdown(c.slice(p));
          return r;
        }).join(" | ");
        tbl += "\n• " + row;
        i++;
      }
      out.push(tbl);
      i--;
      continue;
    }
    let l = line.replace(/^(\s*)[*-]\s+/, "$1• ");
    l = l.replace(/^(\s*)\d+\.\s+/, "$1• ");
    l = l.replace(/^(\s*)#{1,6}\s+(.*)$/, "$1**$2**");
    let res = "";
    let pos = 0;
    const re = /\[([^\]]+)\]\(([^)\s]+)\)|`([^`\n]+)`|\*\*([^*]+?)\*{1,2}|__([^_]+)__|\*([^*\n]+?)\*/g;
    let m;
    while (m = re.exec(l)) {
      res += escapeMarkdown(l.slice(pos, m.index));
      if (m[1] !== undefined) {
        const url = m[2].replace(/\\/g, "").replace(/\)/g, "\\)");
        res += "[" + escapeMarkdown(m[1]) + "](" + url + ")";
      } else if (m[3] !== undefined) {
        res += "`" + m[3].replace(/[`\\]/g, "\\$&") + "`";
      } else if (m[4] !== undefined) {
        res += "*" + escapeMarkdown(m[4]) + "*";
      } else {
        res += "_" + escapeMarkdown(m[5] !== undefined ? m[5] : m[6]) + "_";
      }
      pos = m.index + m[0].length;
    }
    res += escapeMarkdown(l.slice(pos));
    out.push(res);
  }
  return out.join("\n");
}

function escHtml(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function markdownToRichHtml(src) {
  const lines = String(src ?? "").split("\n");
  const out = [];
  let inFence = false;
  let fenceBuf = [];
  const flushFence = () => {
    if (fenceBuf.length) {
      out.push(`<pre><code>${escHtml(fenceBuf.join("\n"))}</code></pre>`);
      fenceBuf = [];
    }
  };
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (/^\s*```/.test(rawLine)) {
      if (!inFence) inFence = true; else {
        flushFence();
        inFence = false;
      }
      continue;
    }
    if (inFence) {
      fenceBuf.push(rawLine);
      continue;
    }
    const isTableRowHtml = s => s.includes("|") && s.trim().length > 0;
    const isSepRowHtml = s => /^\s*\|?[\s:\-|]+\|?[\s]*$/.test(s) && s.includes("---");
    if (isTableRowHtml(rawLine) && isSepRowHtml(lines[i + 1] || "")) {
      const inlineCell = s => {
        let r = "";
        let p = 0;
        const rx = /\[([^\]]+)\]\(([^)\s]+)\)|`([^`\n]+)`|\*\*([^*]+?)\*{1,2}|__([^_]+)__|\*([^*\n]+?)\*/g;
        let mm;
        while (mm = rx.exec(s)) {
          r += escHtml(s.slice(p, mm.index));
          if (mm[1] !== undefined) r += `<a href="${escHtml(mm[2])}">${escHtml(mm[1])}</a>`; else if (mm[3] !== undefined) r += `<code>${escHtml(mm[3])}</code>`; else if (mm[4] !== undefined) r += `<b>${escHtml(mm[4])}</b>`; else r += `<i>${escHtml(mm[5] !== undefined ? mm[5] : mm[6])}</i>`;
          p = mm.index + mm[0].length;
        }
        r += escHtml(s.slice(p));
        return r;
      };
      const parseCellsHtml = s => {
        let parts = s.split("|").map(c => c.trim());
        if (parts[0] === "") parts = parts.slice(1);
        if (parts[parts.length - 1] === "") parts = parts.slice(0, -1);
        return parts;
      };
      const headerCells = parseCellsHtml(rawLine).map(c => `<th>${inlineCell(c)}</th>`).join("");
      let tableHtml = `<table><tr>${headerCells}</tr>`;
      i += 2;
      while (i < lines.length && isTableRowHtml(lines[i]) && !isSepRowHtml(lines[i])) {
        const cells = parseCellsHtml(lines[i]).map(c => `<td>${inlineCell(c)}</td>`).join("");
        tableHtml += `<tr>${cells}</tr>`;
        i++;
      }
      tableHtml += `</table>`;
      out.push(tableHtml);
      i--;
      continue;
    }
    if (/^\s*([-_*]\s*){3,}$/.test(rawLine)) {
      out.push("<hr/>");
      continue;
    }
    const heading = rawLine.match(/^\s*#{1,6}\s+(.*)$/);
    if (heading) {
      out.push(`<b>${escHtml(heading[1])}</b><br>`);
      continue;
    }
    let l = rawLine.replace(/^(\s*)[*-]\s+/, "$1• ");
    l = l.replace(/^(\s*)\d+\.\s+/, "$1• ");
    let res = "";
    let pos = 0;
    const re = /\[([^\]]+)\]\(([^)\s]+)\)|`([^`\n]+)`|\*\*([^*]+?)\*{1,2}|__([^_]+)__|\*([^*\n]+?)\*/g;
    let m;
    while (m = re.exec(l)) {
      res += escHtml(l.slice(pos, m.index));
      if (m[1] !== undefined) res += `<a href="${escHtml(m[2])}">${escHtml(m[1])}</a>`; else if (m[3] !== undefined) res += `<code>${escHtml(m[3])}</code>`; else if (m[4] !== undefined) res += `<b>${escHtml(m[4])}</b>`; else res += `<i>${escHtml(m[5] !== undefined ? m[5] : m[6])}</i>`;
      pos = m.index + m[0].length;
    }
    res += escHtml(l.slice(pos));
    out.push(res.trim() === "" ? "<br/>" : res + "<br>");
  }
  if (inFence) flushFence();
  return out.join("\n");
}

async function sendRichReply(ctx, text) {
  const html = markdownToRichHtml(text);
  const chatId = ctx.chat?.id || ctx.from?.id;
  const replyParam = ctx.message ? {
    reply_parameters: {
      message_id: ctx.message.message_id
    }
  } : {};
  if (!chatId) return ctx.reply(mdToV2(text), {
    parse_mode: "MarkdownV2",
    ...replyParam
  }).catch(() => ctx.reply(text, replyParam));
  try {
    if (ctx.api?.sendRichMessage) {
      await ctx.api.sendRichMessage(chatId, {
        html: html,
        ...replyParam
      });
      return;
    }
    if (ctx.api?.raw?.sendRichMessage) {
      await ctx.api.raw.sendRichMessage({
        chat_id: chatId,
        rich_message: {
          html: html
        },
        ...replyParam
      });
      return;
    }
    await ctx.api.raw.sendRichMessage({
      chat_id: chatId,
      rich_message: {
        html: html
      },
      ...replyParam
    });
  } catch {
    await ctx.reply(mdToV2(text), {
      parse_mode: "MarkdownV2",
      ...replyParam
    }).catch(() => ctx.reply(text, replyParam));
  }
}

async function handleInline(ctx) {
  if (!ctx.inlineQuery) return false;
  const query = ctx.inlineQuery.query?.trim();
  if (/https?:\/\/\S+/i.test(query)) return false;
  const answer = async (results, opts) => {
    try {
      await ctx.answerInlineQuery(results, opts);
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes("query is too old") || msg.includes("query ID is invalid")) return;
      console.error("[Gemini Inline] answer failed:", msg.slice(0, 120));
    }
  };
  if (!query) {
    await answer([ {
      type: "article",
      id: "help",
      title: "Ask Gemini AI",
      thumb_url: GEMINI_THUMB,
      description: "Type a question after @botusername",
      input_message_content: {
        message_text: "Usage: @botusername <your question>"
      }
    } ], {
      cache_time: 0
    });
    return true;
  }
  try {
    const gemini = global.scraper.gemini;
    if (!gemini) throw new Error("Gemini module not available.");
    const userId = String(ctx.from?.id);
    let accText = "";
    let firstChunkAt = 0;
    let answered = false;
    const doAnswer = async fullText => {
      if (answered) return;
      answered = true;
      const text = fullText || accText || "Generating...";
      const clean = mdToV2(text);
      const rich = markdownToRichHtml(text);
      const preview = String(text).replace(/[*_`#]/g, "").slice(0, 200);
      const richQ = escHtml(query);
      try {
        await answer([ {
          type: "article",
          id: "gemini_result_" + Date.now(),
          title: "Gemini AI Answer",
          thumb_url: GEMINI_THUMB,
          description: preview,
          input_message_content: {
            rich_message: {
              html: `<b>Q:</b> ${richQ}\n\n${rich}`
            }
          }
        } ], {
          cache_time: 0
        });
      } catch {
        await answer([ {
          type: "article",
          id: "gemini_result_" + Date.now(),
          title: "Gemini AI Answer",
          thumb_url: GEMINI_THUMB,
          description: preview,
          input_message_content: {
            message_text: `*Q:* ${escapeMarkdown(query)}\n\n${clean}`,
            parse_mode: "MarkdownV2"
          }
        } ], {
          cache_time: 0
        });
      }
    };
    const onChunk = chunk => {
      accText += chunk;
      if (!firstChunkAt) firstChunkAt = Date.now();
      if (!answered && accText.length > 80 && Date.now() - firstChunkAt > 800) {
        doAnswer(accText + "…").catch(() => {});
      }
    };
    const timeoutAnswer = setTimeout(() => {
      if (!answered && accText) doAnswer(accText + "\n\n_Generating…_").catch(() => {}); else if (!answered) doAnswer("Generating answer, please wait...").catch(() => {});
    }, 7500);
    const response = await gemini.chat(query, userId, onChunk);
    clearTimeout(timeoutAnswer);
    const finalText = response && response.text ? response.text : accText;
    if (!finalText) throw new Error("Empty response from Gemini.");
    await doAnswer(finalText);
  } catch (e) {
    console.error("[Gemini Inline]", String(e?.message || e).slice(0, 150));
    if (e.message && e.message.includes("Header overflow")) {
      const gemini = global.scraper.gemini;
      if (gemini) gemini.clearSession(String(ctx.from?.id));
    }
    await answer([ {
      type: "article",
      id: "error",
      title: "Gemini Unavailable",
      thumb_url: GEMINI_THUMB,
      description: "Could not get a response.",
      input_message_content: {
        message_text: "Gemini is currently unavailable."
      }
    } ], {
      cache_time: 0
    });
  }
  return true;
}

async function handleRun(ctx, args) {
  const cmd = ctx.message?.text?.split(" ")[0].replace("/", "").toLowerCase();
  const text = args?.trim();
  if (cmd === "new_session" || cmd === "newsession") {
    const g = global.scraper.gemini;
    if (g) g.clearSession(String(ctx.from?.id));
    return ctx.reply(global.settings.message.newSession);
  }
  if (cmd === "del_session" || cmd === "delsession") {
    const g = global.scraper.gemini;
    if (g) g.clearSession(String(ctx.from?.id));
    return ctx.reply(global.settings.message.delSession);
  }
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
  try {
    const gemini = global.scraper.gemini;
    if (!gemini) throw new Error("Gemini module not available.");
    await (ctx.replyWithChatAction ? ctx.replyWithChatAction("typing") : ctx.api?.sendChatAction(ctx.chat?.id, "typing")).catch(() => {});
    try {
      placeholder = await ctx.reply("*Generating...*", {
        parse_mode: "Markdown"
      });
    } catch {
      placeholder = null;
    }
    let acc = "";
    let lastEdit = 0;
    let lastText = "";
    const onChunk = async chunk => {
      acc += chunk;
      const nowEdit = Date.now();
      if (nowEdit - lastEdit < 1200) return;
      lastEdit = nowEdit;
      const preview = acc.slice(0, 3800);
      if (preview === lastText) return;
      lastText = preview;
      if (placeholder) {
        try {
          await ctx.api.editMessageText(preview, {
            chat_id: placeholder.chat.id,
            message_id: placeholder.message_id
          });
        } catch {}
      }
    };
    const response = await gemini.chat(text, userId, onChunk);
    const finalText = response && response.text ? response.text : acc;
    if (!finalText) throw new Error("Empty response from Gemini.");
    if (placeholder) {
      try {
        await ctx.api.deleteMessage(placeholder.chat.id, placeholder.message_id).catch(() => {});
      } catch {}
    }
    await sendRichReply(ctx, finalText);
  } catch (e) {
    console.error("[Gemini TG]", e.message);
    if (placeholder) {
      try {
        await ctx.api.deleteMessage(placeholder.chat.id, placeholder.message_id).catch(() => {});
      } catch {}
    }
    if (e.message && e.message.includes("Header overflow")) {
      const gemini = global.scraper.gemini;
      if (gemini) gemini.clearSession(userId);
    }
    await ctx.reply(global.settings.message.geminiUnavailable);
  }
}

module.exports = define({
  name: [ "gemini", "new_session", "del_session" ],
  category: "ai",
  help: "Chat with Gemini AI",
  before: handleInline,
  run: async c => handleRun(c.ctx, typeof c.text === "string" ? c.text : (c.args || []).join(" "))
});