const { define: define } = require("../../../sdk");

const cooldowns = new Map;
const COOLDOWN_MS = 5e3;

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

function sanitizeMd(src) {
  let s = String(src ?? "");
  s = s.replace(/\[([^\]\n[]+)\]\(\s*\)/g, "$1");
  s = s.replace(/\[([^\]\n[]+)\(\)/g, "$1");
  s = s.replace(/\[([^\]\n[]+)\(\s*$/gm, "$1");
  s = s.replace(/\[([^\]\n\[]+)$/gm, "$1");
  const balance = (t, token) => {
    let count = 0;
    let idx = 0;
    while ((idx = t.indexOf(token, idx)) !== -1) { count++; idx += token.length; }
    if (count % 2 === 1) {
      const last = t.lastIndexOf(token);
      t = t.slice(0, last) + t.slice(last + token.length);
    }
    return t;
  };
  s = balance(s, "**");
  s = balance(s, "`");
  return s;
}

function splitSmart(text, max) {
  const s = String(text ?? "");
  if (s.length <= max) return [s];
  const parts = [];
  const lines = s.split("\n");
  let cur = "";
  for (const line of lines) {
    if ((cur + "\n" + line).length > max && cur) { parts.push(cur); cur = ""; }
    if (line.length > max) {
      let rest = line;
      while (rest.length > max) { parts.push(rest.slice(0, max)); rest = rest.slice(max); }
      cur = rest;
    } else {
      cur = cur ? cur + "\n" + line : line;
    }
  }
  if (cur) parts.push(cur);
  return parts.length ? parts : [s];
}

function inlineHtml(s) {
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
}

function stripMd(src) {
  let s = sanitizeMd(src);
  s = s.replace(/```([\s\S]*?)```/g, "$1");
  s = s.replace(/\[([^\]\n[]+)\]\([^)\n]*\)/g, "$1");
  s = s.replace(/\*{3,}([^*]+)\*{3,}/g, "$1");
  s = s.replace(/\*{3,}/g, "");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/`([^`\n]+)`/g, "$1");
  s = s.replace(/\*([^*\n]+)\*/g, "$1");
  s = s.replace(/^#{1,6}\s+/gm, "");
  s = s.replace(/^\s*>\s?/gm, "");
  s = s.replace(/^(\s*)[-*]\s+/gm, "$1• ");
  s = s.replace(/^(\s*)\d+\.\s+/gm, "$1• ");
  return s;
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
      const inlineCell = s => inlineHtml(s);
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
      out.push(`<b>${inlineHtml(heading[1])}</b><br>`);
      continue;
    }
    let l = rawLine.replace(/^(\s*)[*-]\s+/, "$1• ");
    l = l.replace(/^(\s*)\d+\.\s+/, "$1• ");
    const res = inlineHtml(l);
    out.push(res.trim() === "" ? "<br/>" : res + "<br>");
  }
  if (inFence) flushFence();
  return out.join("\n");
}

async function sendRichReply(ctx, text) {
  const clean = sanitizeMd(text);
  const html = markdownToRichHtml(clean);
  const chatId = ctx.chat?.id || ctx.from?.id;
  const replyParam = ctx.message ? {
    reply_parameters: {
      message_id: ctx.message.message_id
    }
  } : {};
  const sendChunks = async (chunks, opts) => {
    for (const ch of chunks) {
      await ctx.reply(ch, { ...replyParam, ...opts });
    }
  };
  if (!chatId) {
    const v2 = splitSmart(mdToV2(clean), 4000);
    try {
      await sendChunks(v2, { parse_mode: "MarkdownV2" });
    } catch {
      await sendChunks(splitSmart(stripMd(clean), 4000), {});
    }
    return;
  }
  try {
    await ctx.api.sendRichMessage(chatId, { html: html.slice(0, 32000) }, replyParam);
    return;
  } catch {}
  try {
    await sendChunks(splitSmart(mdToV2(clean), 4000), { parse_mode: "MarkdownV2" });
    return;
  } catch {}
  await sendChunks(splitSmart(stripMd(clean), 4000), {});
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
  const canDraft = typeof ctx.replyWithRichMessageDraft === "function";
  let placeholder = null;
  let draftMode = false;
  let draftFailed = false;
  let busy = false;
  try {
    const gemini = global.scraper.gemini;
    if (!gemini) throw new Error("Gemini module not available.");
    await ctx.replyWithChatAction("typing").catch(() => ctx.api?.sendChatAction(ctx.chat?.id, "typing").catch(() => {}));
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
      const partial = acc.slice(0, 30000);
      if (partial === lastSent || partial.length < 20) return;
      lastSent = partial;
      busy = true;
      try {
        if (canDraft && !draftFailed) {
          await ctx.replyWithRichMessageDraft({ html: markdownToRichHtml(sanitizeMd(partial)) });
          if (!draftMode) {
            draftMode = true;
            if (placeholder) {
              try { await ctx.api.deleteMessage(placeholder.chat.id, placeholder.message_id); } catch {}
              placeholder = null;
            }
          }
        } else if (placeholder) {
          await ctx.api.editMessageText(placeholder.chat.id, placeholder.message_id, partial.slice(0, 3800));
        }
      } catch {
        if (!draftMode) draftFailed = true;
      } finally {
        busy = false;
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
  name: [ "gemini" ],
  category: "ai",
  help: "Chat with Gemini AI",
  run: async c => handleRun(c.ctx, typeof c.text === "string" ? c.text : (c.args || []).join(" "))
});