const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const { getFileInfo: getFileInfo, detectSource: detectSource } = require("../_lib/downloader");
const { define: define } = require("../../../sdk");
const fmt = require("../../../sdk/core");

const tgsdk = require("../../../sdk/telegram");

function toInputFilePath(filePath) {
  return tgsdk.inputFile(filePath);
}

const urlMap = new Map;

function remember(url, baseOpts) {
  const h = crypto.createHash("md5").update(url + Date.now()).digest("hex").slice(0, 10);
  urlMap.set(h, { url: url, baseOpts: baseOpts || {} });
  if (urlMap.size > 200) urlMap.delete(urlMap.keys().next().value);
  return h;
}

function formatKeyboard(hash, isAudio) {
  return {
    inline_keyboard: [[
      isAudio
        ? { text: "Video", callback_data: `dl:${hash}:v` }
        : { text: "Audio", callback_data: `dl:${hash}:a` }
    ]]
  };
}

function fmtDur(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor(s % 3600 / 60);
  const r = s % 60;
  const p = n => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(r)}` : `${m}:${p(r)}`;
}

function buildLimitCard(limit) {
  const B = fmt.bold.tg;
  const E = fmt.esc;
  const maxMB = Math.round((limit.maxSize || 0) / 1024 / 1024);
  const chk = fmt.sizeLimit(limit.biggest || 0, maxMB);
  const L = [];
  L.push("乂  " + B(fmt.spaced("FILE-LIMIT")));
  L.push("");
  const row = (k, v) => "\t◦  " + B(k) + " : " + (v == null || v === "" ? "-" : E(String(v)));
  if (limit.title) L.push(row("Title", limit.title));
  L.push(row("Size", chk.size));
  L.push(row("Max", maxMB + "MB"));
  L.push("");
  L.push(E(global.settings.message.fileTooLarge.replace("{size}", chk.size).replace("{max}", String(maxMB))));
  return L.join("\n");
}

function buildCard(info, source, showingAudio, size) {
  const B = fmt.bold.tg;
  const E = fmt.esc;
  const L = [];
  L.push("乂  " + B(fmt.spaced("DOWNLOADER")));
  L.push("");
  const row = (k, v) => "\t◦  " + B(k) + " : " + (v == null || v === "" ? "-" : E(String(v)));
  if (info.title) L.push(row("Title", info.title));
  const srcName = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", twitter: "Twitter/X", spotify: "Spotify", soundcloud: "SoundCloud" }[source] || fmt.cap(source);
  L.push(row("Source", srcName));
  L.push(row("Type", showingAudio ? "Audio" : "Video"));
  if (info.uploader) L.push(row("Uploader", info.uploader));
  if (info.duration) L.push(row("Duration", fmtDur(info.duration)));
  if (size) L.push(row("Size", fmt.formatSize(size)));
  return L.join("\n");
}

async function dlOnce(url, dlOpts, maxSize) {
  const dl = global.scraper.ytdpl;
  const result = await dl.download(url, dlOpts);
  let file = null;
  let size = 0;
  let biggest = 0;
  for (const f of result.files || []) {
    try {
      const stat = await fs.stat(f);
      if (stat.size > biggest) biggest = stat.size;
      if (!file && stat.size <= maxSize) {
        file = f;
        size = stat.size;
      }
    } catch {}
  }
  return { file: file, size: size, biggest: biggest, directory: result.directory };
}

async function downloadOne(url, opts) {
  const dl = global.scraper.ytdpl;
  if (!dl) throw new Error("Downloader not available");
  const dlOpts = { ...(opts || {}) };
  const cookiesPath = path.join(__dirname, "../../../../../cookies.txt");
  try {
    await fs.access(cookiesPath);
    if (!dlOpts.cookies) dlOpts.cookies = cookiesPath;
  } catch {}
  const maxSize = (global.settings.max_uploud || 50) * 1024 * 1024;
  let attempt = await dlOnce(url, dlOpts, maxSize);
  if (!attempt.file && !dlOpts.audioOnly && !dlOpts.format) {
    for (const h of [720, 480]) {
      try { await dl.cleanup(attempt.directory); } catch {}
      try {
        attempt = await dlOnce(url, { ...dlOpts, format: `bv*[height<=${h}]+ba/b/best[height<=${h}]/best` }, maxSize);
      } catch {
        continue;
      }
      if (attempt.file) break;
    }
  }
  if (!attempt.file) {
    try { await dl.cleanup(attempt.directory); } catch {}
    const err = new Error("LIMIT");
    err.limit = { biggest: attempt.biggest, maxSize: maxSize };
    try {
      const meta = await dl.getMetadata(url);
      const info = Array.isArray(meta) ? meta[0] || {} : meta || {};
      if (info.title) err.limit.title = info.title;
    } catch {}
    throw err;
  }
  const file = attempt.file;
  const size = attempt.size;
  let info = {};
  try {
    const meta = await dl.getMetadata(url);
    info = Array.isArray(meta) ? meta[0] || {} : meta || {};
  } catch {}
  return { file: file, info: info, directory: attempt.directory, size: size };
}

async function sendResult(ctx, url, baseOpts, isAudio, editMsg) {
  const opts = { ...(baseOpts || {}) };
  if (isAudio) opts.audioOnly = true; else delete opts.audioOnly;
  const { file: file, info: info, directory: directory, size: size } = await downloadOne(url, opts);
  try {
    const fi = getFileInfo(file);
    const showingAudio = isAudio || fi.type === "audio";
    const caption = buildCard(info, detectSource(url), showingAudio, size);
    const convertible = isAudio || fi.type === "video" || fi.type === "audio";
    const keyboard = convertible ? formatKeyboard(remember(url, baseOpts), showingAudio) : undefined;
    const extra = { parse_mode: "HTML", ...(keyboard ? { reply_markup: keyboard } : {}) };
    if (editMsg && convertible) {
      const media = (isAudio || fi.type === "audio")
        ? { type: "audio", media: toInputFilePath(file), title: String(info.title || "Audio").slice(0, 60), performer: String(info.uploader || "").slice(0, 60), caption: caption, parse_mode: "HTML" }
        : { type: "video", media: toInputFilePath(file), caption: caption, parse_mode: "HTML", supports_streaming: true };
      try {
        await ctx.editMessageMedia(media, keyboard ? { reply_markup: keyboard } : {});
        return;
      } catch {}
    }
    if (isAudio || fi.type === "audio") {
      await ctx.replyWithAudio(toInputFilePath(file), { title: String(info.title || "Audio").slice(0, 60), performer: String(info.uploader || "").slice(0, 60), caption: caption, ...extra });
    } else if (fi.type === "video") {
      await ctx.replyWithVideo(toInputFilePath(file), { caption: caption, ...extra, supports_streaming: true });
    } else if (fi.type === "photo") {
      await ctx.replyWithPhoto(toInputFilePath(file), { caption: caption, parse_mode: "HTML" });
    } else {
      await ctx.replyWithDocument(toInputFilePath(file), { caption: caption, parse_mode: "HTML" });
    }
  } finally {
    try { await global.scraper.ytdpl.cleanup(directory); } catch {}
  }
}

let _udl = null;
try { _udl = require("../../../../scrapers/src/unified-downloader"); } catch {}
module.exports = define({
  name: [ "dl" ],
  category: "downloader",
  help: "Download video or audio from YouTube, TikTok, Instagram, Twitter/X, Facebook (yt-dlp 1752 extractors, supports ALL yt-dlp flags)",
  run: async ctx => {
    const args = ctx.text || "";
    if (!args) {
      const supported = (_udl && _udl.getSupportedProviders) ? _udl.getSupportedProviders().slice(0,12).map(p=> `${p.name} (${p.domains[0]})`) : [ "YouTube (video, shorts, music)", "TikTok (video, slides)", "Instagram (post, reel, carousel)", "Twitter/X (video, photos)", "Facebook (video)", "SoundCloud", "Pinterest", "Reddit", "Twitch", "Vimeo", "Dailymotion", "Generic (any of 1752 yt-dlp sites)" ];
      return ctx.reply("Usage:\n" + "/dl <url> - Download video/photo\n" + "/dl <url> --audio - Download as audio\n" + "/dl <url> --audio-format mp3 --embed-thumbnail\n" + "/dl <url> --write-subs --sub-langs en --convert-subs srt\n" + "/dl <url> --format \"bv*+ba/b\" --format-sort \"res:720\" --download-sections \"*0:30-1:00\"\n\n" + "Supported platforms (1752 extractors via yt-dlp):\n" + supported.map(s => "- " + s).join("\n") + "\n\nExamples:\n" + "/dl https://youtu.be/xxxxx\n" + "/dl https://vt.tiktok.com/xxxxx --audio\n" + "/dl https://soundcloud.com/artist/track --audio --audio-format opus\n\n" + "Tip: use the button under a video or audio result to switch format.");
    }

    let cleanUrl = null;
    let opts = {};
    if (_udl && typeof _udl.parseCliFlags === "function") {
      const urlMatch = args.match(/https?:\/\/[^\s]+/i);
      if (urlMatch) {
        cleanUrl = urlMatch[0].replace(/[.,!?;:]+$/, "");
        const after = args.slice(args.indexOf(urlMatch[0]) + urlMatch[0].length).trim();
        if (after) opts = _udl.parseCliFlags(after);
        else {
          const before = args.slice(0, args.indexOf(urlMatch[0])).trim();
          if (before && /--/.test(before)) Object.assign(opts, _udl.parseCliFlags(before));
        }
        if (/--audio|--mp3|--music/.test(args) && !opts.audioOnly) opts.audioOnly = true;
      } else {
        cleanUrl = null;
      }
    } else {
      const isAudio = /--audio|--mp3|--music/.test(args);
      const url = args.replace(/\s*(?:--audio|--mp3|--music)\s*/i, "").trim();
      const match = url.match(/https?:\/\/[^\s]+/i);
      cleanUrl = match ? match[0].replace(/[.,!?;:]+$/, "") : null;
      opts = isAudio ? { audioOnly:true } : {};
    }
    if (!cleanUrl) {
      return ctx.reply(global.settings.message.needUrl);
    }

    const baseOpts = { ...opts };
    delete baseOpts.audioOnly;
    const isAudio = !!opts.audioOnly;
    let status = null;
    try {
      try { status = await ctx.reply(global.settings.message.downloading); } catch {}
      await sendResult(ctx, cleanUrl, baseOpts, isAudio, null);
    } catch (e) {
      if (e && e.message === "LIMIT" && e.limit) {
        await ctx.reply(buildLimitCard(e.limit), { parse_mode: "HTML" }).catch(() => {});
      } else {
        await ctx.reply(global.settings.message.downloaderError.replace("{error}", e.message || "failed")).catch(() => {});
      }
    } finally {
      if (status) {
        try { await ctx.api.deleteMessage(status.chat.id, status.message_id); } catch {}
      }
    }
  },
  onCallback: async ctx => {
    const data = ctx.callbackQuery?.data || "";
    if (!data.startsWith("dl:")) return;
    const parts = data.split(":");
    const entry = urlMap.get(parts[1]);
    if (!entry) {
      await ctx.answerCallbackQuery(global.settings.message.expiredButton).catch(() => {});
      return;
    }
    const isAudio = parts[2] === "a";
    await ctx.answerCallbackQuery(isAudio ? global.settings.message.fetchingAudio : global.settings.message.fetchingVideo).catch(() => {});
    try {
      await sendResult(ctx, entry.url, entry.baseOpts, isAudio, ctx.callbackQuery.message);
    } catch (e) {
      try {
        if (e && e.message === "LIMIT" && e.limit) {
          await ctx.reply(buildLimitCard(e.limit), { parse_mode: "HTML" });
        } else {
          await ctx.reply(global.settings.message.downloaderError.replace("{error}", e.message || "failed"));
        }
      } catch {}
    }
  }
});
