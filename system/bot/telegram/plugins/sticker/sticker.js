const fs = require("fs");
const tgsdk = require("../../../sdk/telegram");
const { define: define } = require("../../../sdk");

async function dlBuf(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error("Fetch failed: HTTP " + res.status);
  return Buffer.from(await res.arrayBuffer());
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
  if (typeof file.getUrl === "function") return dlBuf(file.getUrl());
  throw new Error("Download unavailable");
}

async function toPng512(buf) {
  const { Jimp: Jimp } = require("jimp");
  let img = await Jimp.read(buf);
  img = img.contain({ w: 512, h: 512 });
  let out = await img.getBuffer("image/png");
  let w = img.width;
  while (out.length > 500 * 1024 && w > 128) {
    w = Math.round(w * 0.8);
    const r = Math.round((img.height * w) / img.width);
    img = img.resize({ w: w, h: r });
    out = await img.getBuffer("image/png");
  }
  if (out.length > 512 * 1024) throw new Error("Image too large even after shrink");
  return out;
}

async function imgSource(ctx, args) {
  const m = String(args || "").match(/https?:\/\/[^\s]+/i);
  if (m) return dlBuf(m[0].replace(/[.,!?;:]+$/, ""));
  const msg = ctx.message || ctx.msg || {};
  const rep = msg.reply_to_message || {};
  const photo = (rep.photo && rep.photo.length ? rep.photo : null) || (msg.photo && msg.photo.length ? msg.photo : null);
  if (photo && photo.length) return tgDownload(ctx, photo[photo.length - 1].file_id);
  const doc = msg.document || rep.document;
  if (doc && doc.file_id && (!doc.mime_type || doc.mime_type.startsWith("image/"))) return tgDownload(ctx, doc.file_id);
  return null;
}

function botUsername(ctx) {
  return ctx.me?.username || global.telegramBot?.bot?.botInfo?.username || "";
}

async function runSticker(ctx, args) {
  const buf = await imgSource(ctx, args);
  if (!buf) return ctx.reply(global.settings.message.imageNeed).catch(() => {});
  await ctx.replyWithChatAction("upload_photo").catch(() => {});
  const png = await toPng512(buf);
  await ctx.replyWithSticker(tgsdk.inputFile(png, "sticker.png")).catch(async () => {
    await ctx.replyWithDocument(tgsdk.inputFile(png, "sticker.png"), { caption: "Static sticker (PNG 512px)" }).catch(() => {});
  });
}

const os = require("os");
const path = require("path");
const crypto = require("crypto");

function tmpFile(ext) {
  return path.join(os.tmpdir(), "akano-" + crypto.randomBytes(6).toString("hex") + ext);
}

async function ffRun(inPath, outPath, args) {
  const { spawn: spawn } = require("child_process");
  await new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", ["-y", "-i", inPath, ...args, outPath]);
    p.on("error", reject);
    p.on("close", code => code === 0 ? resolve() : reject(new Error("Convert failed")));
  });
}

async function dlToTmp(ctx, fileId, ext) {
  const file = await ctx.api.getFile(fileId);
  if (!file) throw new Error("File not found");
  const ext2 = ext || path.extname(file.file_path || "") || ".bin";
  const dest = tmpFile(ext2);
  if (typeof file.download === "function") {
    const tmp = await file.download(dest);
    return tmp || dest;
  }
  const buf = await dlBuf(file.getUrl());
  await fs.promises.writeFile(dest, buf);
  return dest;
}

function animTarget(msg) {
  const rep = msg.reply_to_message || {};
  const cand = rep.sticker || rep.document || rep.video || rep.animation || msg.sticker || msg.document || msg.video || msg.animation;
  if (!cand || !cand.file_id) return null;
  return cand;
}

async function runKang(ctx, args) {
  const msg = ctx.message || ctx.msg || {};
  const rep = msg.reply_to_message || {};
  const uid = ctx.from?.id;
  if (!uid) return;
  const emoji = (String(args || "").match(/\p{Extended_Pictographic}/u) || ["😀"])[0];
  await ctx.replyWithChatAction("typing").catch(() => {});
  let fileId = rep.sticker?.file_id || null;
  if (!fileId) {
    const buf = await imgSource(ctx, args);
    if (!buf) return ctx.reply(global.settings.message.imageNeed).catch(() => {});
    const png = await toPng512(buf);
    const up = await ctx.api.uploadStickerFile(uid, "static", tgsdk.inputFile(png, "kang.png"));
    fileId = up.file_id;
  }
  const me = await ctx.api.getMe().catch(() => null);
  const bun = (me?.username || botUsername(ctx) || "bot").toLowerCase();
  const setName = `akano_by_${bun}`;
  const sticker = { sticker: fileId, format: "static", emoji_list: [emoji] };
  const exists = await ctx.api.getStickerSet(setName).then(() => true).catch(() => false);
  if (exists) {
    await ctx.api.addStickerToSet(uid, setName, sticker);
  } else {
    await ctx.api.createNewStickerSet(uid, setName, "Akano Pack", [sticker]);
  }
  await ctx.reply(`Added to <a href="https://t.me/addstickers/${setName}">Akano Pack</a> ${emoji}`, { parse_mode: "HTML" }).catch(() => {});
}

async function runGetSticker(ctx) {
  const msg = ctx.message || ctx.msg || {};
  const rep = msg.reply_to_message || {};
  const stk = rep.sticker || msg.sticker;
  if (!stk || !stk.file_id) return ctx.reply("Reply to a sticker.").catch(() => {});
  await ctx.replyWithChatAction("upload_document").catch(() => {});
  const kind = stk.is_video ? "video" : stk.is_animated ? "animated" : "static";
  const p = await dlToTmp(ctx, stk.file_id);
  try {
    await ctx.replyWithDocument(tgsdk.inputFile(p), { caption: `${kind} sticker ${stk.emoji || ""} (${(stk.file_size / 1024).toFixed(0)}KB)` }).catch(() => {});
  } finally {
    try { await fs.promises.unlink(p).catch(() => {}); } catch {}
  }
}

async function runGetPack(ctx, args) {
  const raw = String(args || "").trim().split(/\s+/)[0] || "";
  const name = raw.replace(/^https?:\/\/t\.me\/addstickers\//, "").trim();
  if (!name) return ctx.reply("Send a pack link. Example: https://t.me/addstickers/animals").catch(() => {});
  await ctx.replyWithChatAction("typing").catch(() => {});
  const set = await ctx.api.getStickerSet(name).catch(() => null);
  if (!set || !(set.stickers || []).length) return ctx.reply("Pack not found.").catch(() => {});
  const list = set.stickers.slice(0, 10);
  await ctx.reply(`${set.title || set.name}: ${set.stickers.length} stickers, sending ${list.length}...`).catch(() => {});
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const ext = s.is_video ? ".webm" : s.is_animated ? ".tgs" : ".webp";
    try {
      const p = await dlToTmp(ctx, s.file_id, ext);
      try {
        await ctx.replyWithDocument(tgsdk.inputFile(p, `${set.name}_${i}${ext}`)).catch(() => {});
      } finally {
        try { await fs.promises.unlink(p).catch(() => {}); } catch {}
      }
    } catch {}
  }
}

async function runConvert(ctx, toMp4) {
  const msg = ctx.message || ctx.msg || {};
  const t = animTarget(msg);
  if (!t) return ctx.reply("Reply to a sticker, GIF, or video.").catch(() => {});
  await ctx.replyWithChatAction("upload_video").catch(() => {});
  const src = await dlToTmp(ctx, t.file_id);
  const out = tmpFile(toMp4 ? ".mp4" : ".webm");
  try {
    if (toMp4) await ffRun(src, out, ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart"]);
    else await ffRun(src, out, ["-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "30"]);
    if (toMp4) await ctx.replyWithVideo(tgsdk.inputFile(out)).catch(() => {});
    else await ctx.replyWithDocument(tgsdk.inputFile(out, "converted.webm")).catch(() => {});
  } finally {
    try { await fs.promises.unlink(src).catch(() => {}); } catch {}
    try { await fs.promises.unlink(out).catch(() => {}); } catch {}
  }
}

module.exports = define({
  name: ["sticker", "kang", "getsticker", "getpack", "tomp4", "towebm"],
  category: "sticker",
  help: "Sticker maker & downloader",
  run: async c => {
    const ctx = c.ctx;
    const cmd = String(c.command || (ctx.message?.text || ctx.message?.caption || ctx.msg?.caption || "").split(" ")[0].replace("/", "").toLowerCase() || "");
    const args = typeof c.text === "string" ? c.text : (c.args || []).join(" ");
    try {
      if (cmd === "kang") return await runKang(ctx, args);
      if (cmd === "getsticker") return await runGetSticker(ctx);
      if (cmd === "getpack") return await runGetPack(ctx, args);
      if (cmd === "tomp4") return await runConvert(ctx, true);
      if (cmd === "towebm") return await runConvert(ctx, false);
      return await runSticker(ctx, args);
    } catch (e) {
      await ctx.reply(global.settings.message.downloaderError.replace("{error}", e.message || "failed")).catch(() => {});
    }
  }
});
