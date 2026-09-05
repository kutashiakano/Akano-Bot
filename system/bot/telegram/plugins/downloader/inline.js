const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const {getFileInfo: getFileInfo, buildCaption: buildCaption, detectSource: detectSource} = require("../_lib/downloader");

const HTML = {
  parse_mode: "HTML"
};

const {define: define} = require("../../../plugin");

const urlMap = new Map;

function remember(url) {
  const h = crypto.createHash("md5").update(url).digest("hex").slice(0, 10);
  urlMap.set(h, url);
  if (urlMap.size > 200) urlMap.delete(urlMap.keys().next().value);
  return h;
}

async function quickTitle(url) {
  try {
    const dl = global.scraper.ytdpl;
    if (!dl?.getMetadata) return {
      title: "Media"
    };
    const meta = await Promise.race([ dl.getMetadata(url), new Promise((_, rej) => setTimeout(() => rej(new Error("slow")), 3e3)) ]);
    const info = Array.isArray(meta) ? meta[0] : meta;
    return {
      title: info?.title || "Media",
      thumbnail: info?.thumbnail
    };
  } catch {
    return {
      title: "Media"
    };
  }
}

async function deliver(ctx, url, isAudio) {
  const dl = global.scraper.ytdpl;
  if (!dl) throw new Error("Downloader not available");
  await ctx.editMessageText("┏「 Downloader 」\n│  ◦  Fetching media...\n┗¸").catch(() => {});
  const opts = {};
  const cookiesPath = path.join(__dirname, "../../../../../cookies.txt");
  try {
    await fs.access(cookiesPath);
    opts.cookies = cookiesPath;
  } catch {}
  if (isAudio) opts.audioOnly = true;
  const result = await dl.download(url, opts);
  const maxSize = (global.settings.max_uploud || 50) * 1024 * 1024;
  let file = null;
  for (const f of result.files || []) {
    try {
      const stat = await fs.stat(f);
      if (stat.size <= maxSize) {
        file = f;
        break;
      }
    } catch {}
  }
  if (!file) {
    await dl.cleanup(result.directory).catch(() => {});
    throw new Error("File exceeds size limit");
  }
  let info = {};
  try {
    const meta = await dl.getMetadata(url);
    info = Array.isArray(meta) ? meta[0] || {} : meta || {};
  } catch {}
  const fi = getFileInfo(file);
  const caption = buildCaption(info, detectSource(url));
  let media;
  if (isAudio || fi.type === "audio") {
    media = {
      type: "audio",
      media: file,
      title: (info.title || "Audio").slice(0, 60),
      performer: String(info.uploader || "").slice(0, 60)
    };
  } else if (fi.type === "video") {
    media = {
      type: "video",
      media: file,
      supports_streaming: true
    };
  } else if (fi.type === "photo") {
    media = {
      type: "photo",
      media: file
    };
  } else {
    media = {
      type: "document",
      media: file
    };
  }
  media.caption = caption;
  media.parse_mode = HTML.parse_mode;
  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await ctx.editMessageMedia(media);
      await dl.cleanup(result.directory).catch(() => {});
      return;
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      if (!/hang up|timeout|ECONN|EPIPE|fetch failed|network/i.test(msg)) throw e;
      console.log(`[idl] upload retry ${attempt}/3 - ${msg.slice(0, 80)}`);
      await new Promise(r => setTimeout(r, attempt * 3e3));
    }
  }
  throw lastErr;
}

module.exports = define({
  name: [ "inline" ],
  category: "downloader",
  help: "Inline downloader (type @botname <link>)",
  hidden: true,
  before: async ctx => {
    if (!ctx.inlineQuery) return false;
    const q = ctx.inlineQuery.query || "";
    const m = q.match(/https?:\/\/[^\s]+/i);
    if (!m) return false;
    const url = m[0].replace(/[.,!?;:]+$/, "");
    const {title: title, thumbnail: thumbnail} = await quickTitle(url);
    const h = remember(url);
    await ctx.answerInlineQuery([ {
      type: "article",
      id: "dl_" + h,
      title: "📥 Download: " + title,
      description: url,
      thumb_url: thumbnail,
      input_message_content: {
        message_text: "┏「 Downloader 」\n│  ◦ " + title + "\n│  ◦ Choose format below\n┗¸"
      },
      reply_markup: {
        inline_keyboard: [ [ {
          text: "🎬 Video",
          callback_data: `idl:${h}:v`
        }, {
          text: "🎧 Audio",
          callback_data: `idl:${h}:a`
        } ] ]
      }
    } ], {
      cache_time: 0
    }).catch(() => {});
    return true;
  },
  onCallback: async ctx => {
    const data = ctx.callbackQuery?.data || "";
    if (!data.startsWith("idl:")) return;
    const parts = data.split(":");
    const url = urlMap.get(parts[1]);
    if (!url) {
      await ctx.answerCallbackQuery("Expired. Share the link again.").catch(() => {});
      return;
    }
    const isAudio = parts[2] === "a";
    await ctx.answerCallbackQuery(isAudio ? "Fetching audio..." : "Fetching video...").catch(() => {});
    try {
      await deliver(ctx, url, isAudio);
    } catch (e) {
      global.logError?.("telegram.inlineDl", e);
      await ctx.editMessageText(global.settings.message.downloaderError.replace("{error}", e.message || "failed")).catch(() => {});
    }
  }
});