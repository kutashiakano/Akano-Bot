import fs from "node:fs";
import path from "node:path";
import { defineBot as define } from "@kutashiakanocanzy/sdk";

const COOKIES_PATH = path.join(process.cwd(), "cookies.txt");

function validateNetscape(text) {
  const lines = String(text || "").split("\n").map(l => l.trim()).filter(Boolean);
  if (!lines.length) return { ok: false, reason: "Empty file." };
  const head = lines.find(l => l.startsWith("#"));
  if (!head || !/netscape/i.test(head)) return { ok: false, reason: "Missing '# Netscape HTTP Cookie File' header." };
  const rows = lines.filter(l => !l.startsWith("#"));
  if (!rows.length) return { ok: false, reason: "No cookie rows found." };
  const bad = rows.filter(l => l.split("\t").length < 6);
  if (bad.length > rows.length / 2) return { ok: false, reason: "Rows are not tab-separated (broken copy-paste?)." };
  return { ok: true, count: rows.length };
}

async function tgDownload(ctx, fileId) {
  const file = await ctx.api.getFile(fileId);
  if (!file) throw new Error("File not found");
  if (typeof file.download === "function") {
    const tmp = await file.download();
    const buf = await fs.promises.readFile(tmp);
    try { await fs.promises.unlink(tmp).catch(() => {}); } catch {}
    return buf;
  }
  if (typeof file.getUrl === "function") {
    const res = await fetch(file.getUrl(), { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error("Fetch failed: HTTP " + res.status);
    return Buffer.from(await res.arrayBuffer());
  }
  throw new Error("Download unavailable");
}

export default define({
  name: ["cookies"],
  category: "tools",
  help: "Install yt-dlp login cookies from phone (owner only)",
  owner: true,
  run: async ctx => {
    const msg = ctx.message || ctx.msg || {};
    const rep = msg.reply_to_message || {};
    const doc = msg.document || rep.document;
    const pasted = String(ctx.text || "").trim();
    if (!doc && !pasted) {
      let info = "No cookies installed.";
      try {
        if (fs.existsSync(COOKIES_PATH)) {
          const st = fs.statSync(COOKIES_PATH);
          const n = String(fs.readFileSync(COOKIES_PATH, "utf8")).split("\n").filter(l => l.trim() && !l.trim().startsWith("#")).length;
          info = `Installed: ${n} cookies (${(st.size / 1024).toFixed(1)} KB).`;
        }
      } catch {}
      return ctx.reply(`${info}\n\nSend cookies.txt as a document, or reply to one with /cookies.\nExport from phone with an app like "Get cookies.txt" (Android).`).catch(() => {});
    }
    let content = pasted;
    try {
      if (doc && doc.file_id) content = (await tgDownload(ctx, doc.file_id)).toString("utf8");
    } catch (e) {
      return ctx.reply("Could not download the file: " + String((e && e.message) || e).slice(0, 120)).catch(() => {});
    }
    if (content.length > 300000) return ctx.reply("File too large (max ~300KB).").catch(() => {});
    const v = validateNetscape(content);
    if (!v.ok) return ctx.reply("Invalid cookies.txt: " + v.reason).catch(() => {});
    try {
      if (fs.existsSync(COOKIES_PATH)) fs.copyFileSync(COOKIES_PATH, COOKIES_PATH + ".bak");
      fs.writeFileSync(COOKIES_PATH, content.replace(/\r\n/g, "\n"));
    } catch (e) {
      return ctx.reply("Failed to save: " + String((e && e.message) || e).slice(0, 120)).catch(() => {});
    }
    return ctx.reply(`Cookies installed: ${v.count} saved. Music + downloader use login session now.`).catch(() => {});
  }
});
