const HTML = {
  parse_mode: "HTML"
};

const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");

let InputFile = null;

try {
  ({InputFile: InputFile} = require("grammy"));
} catch {
  try {
    InputFile = require("@grammyjs/files").InputFile;
  } catch {}
}

function toInputFile(filePath) {
  if (InputFile) {
    try {
      return new InputFile(filePath);
    } catch {}
    try {
      return new InputFile(fsSync.createReadStream(filePath), path.basename(filePath));
    } catch {}
  }
  return {
    source: filePath
  };
}

function toMediaInput(filePath, type) {
  const input = toInputFile(filePath);
  if (input instanceof InputFile) return input;
  return input;
}

function getFileInfo(file) {
  const ext = path.extname(file).toLowerCase();
  const imageExts = [ ".jpg", ".jpeg", ".png", ".gif", ".webp" ];
  const videoExts = [ ".mp4", ".webm", ".mov", ".mkv" ];
  const audioExts = [ ".mp3", ".m4a", ".opus", ".wav", ".ogg" ];
  if (imageExts.includes(ext)) return {
    type: "photo",
    ext: ext
  };
  if (videoExts.includes(ext)) return {
    type: "video",
    ext: ext
  };
  if (audioExts.includes(ext)) return {
    type: "audio",
    ext: ext
  };
  return {
    type: "document",
    ext: ext
  };
}

function buildCaption(info, source) {
  const lines = [];
  const title = info.title || info.description || "Media";
  const author = info.uploader || info.channel || info.creator || "Unknown";
  const desc = info.description || "";
  const duration = info.duration || 0;
  const views = info.view_count || 0;
  if (source === "tiktok") {
    lines.push(`<b>TikTok ${info._type === "photo" ? "Slide" : "Video"}</b>`);
    if (author !== "Unknown") lines.push(`By: ${author}`);
    if (desc) lines.push(`\n${desc}`);
  } else if (source === "instagram") {
    lines.push(`<b>Instagram ${Array.isArray(info._raw) ? "Carousel" : "Post"}</b>`);
    if (author !== "Unknown") lines.push(`By: ${author}`);
    if (desc) lines.push(`\n${desc}`);
  } else if (source === "youtube") {
    lines.push(`<b>YouTube ${duration > 0 ? "Video" : "Short"}</b>`);
    lines.push(`${title}`);
    if (author !== "Unknown") lines.push(`By: ${author}`);
    if (duration > 0) lines.push(`Duration: ${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`);
    if (views > 0) lines.push(`Views: ${views.toLocaleString()}`);
    if (desc && desc.length > 0) {
      const shortDesc = desc.length > 200 ? desc.substring(0, 200) + "..." : desc;
      lines.push(`\n${shortDesc}`);
    }
  } else if (source === "search") {
    lines.push(`<b>YouTube Music</b>`);
    lines.push(`${title}`);
    if (author !== "Unknown") lines.push(`By: ${author}`);
    if (duration > 0) lines.push(`Duration: ${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`);
  } else if (source === "facebook") {
    lines.push(`<b>Facebook Video</b>`);
    if (title && title !== "Unknown") lines.push(`${title}`);
    if (author !== "Unknown") lines.push(`By: ${author}`);
    if (duration > 0) lines.push(`Duration: ${Math.floor(duration)}s`);
  } else if (source === "twitter") {
    lines.push(`<b>Twitter/X ${info._type === "photo" ? "Media" : "Video"}</b>`);
    if (author !== "Unknown") lines.push(`By: ${author}`);
    if (desc) lines.push(`\n${desc}`);
    if (duration > 0) lines.push(`Duration: ${Math.floor(duration)}s`);
  } else if (source === "spotify") {
    lines.push(`<b>Spotify Track</b>`);
    lines.push(`${title}`);
    if (author !== "Unknown") lines.push(`By: ${author}`);
    if (duration > 0) lines.push(`Duration: ${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`);
  } else {
    lines.push(`<b>Media Download</b>`);
    if (title && title !== "Media") lines.push(`${title}`);
    if (author !== "Unknown") lines.push(`By: ${author}`);
    if (duration > 0) lines.push(`Duration: ${Math.floor(duration)}s`);
  }
  return lines.join("\n");
}

let _unified = null;
try { _unified = require("../../../../scrapers/src/unified-downloader"); } catch {}
function detectSource(url) {
  if (_unified && typeof _unified.detectSource === "function") return _unified.detectSource(url);
  if (/tiktok\.com|vt\.tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com|vt\.tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/youtube\.com|youtu\.be|music\.youtube\.com/i.test(url)) return "youtube";
  if (/facebook\.com|fb\.watch/i.test(url)) return "facebook";
  if (/x\.com|twitter\.com/i.test(url)) return "twitter";
  if (/open\.spotify\.com|spotify\.link/i.test(url)) return "spotify";
  if (/soundcloud\.com/i.test(url)) return "soundcloud";
  if (/pinterest\.com|pin\.it/i.test(url)) return "pinterest";
  if (/reddit\.com|redd\.it/i.test(url)) return "reddit";
  if (/twitch\.tv/i.test(url)) return "twitch";
  if (/vimeo\.com/i.test(url)) return "vimeo";
  if (/dailymotion\.com|dai\.ly/i.test(url)) return "dailymotion";
  return "generic";
}

async function sendWithRetry(fn, tries = 3) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message || e);
      if (/429|retry after/i.test(msg)) {
        await new Promise(r => setTimeout(r, 1e4));
        continue;
      }
      if (!/hang up|timeout|ECONN|EPIPE|EAI_AGAIN|fetch failed|network/i.test(msg)) throw e;
      console.log(`[dl] send retry ${i}/${tries} - ${msg.slice(0, 80)}`);
      await new Promise(r => setTimeout(r, i * 3e3));
    }
  }
  throw lastErr;
}


async function downloadMedia(ctx, url, isAudio = false) {
  try {
    const source = detectSource(url);
    if (source === "spotify" && global.scraper?.spotify) {
      const spotify = global.scraper.spotify;
      await ctx.reply("🕒 Fetching Spotify track, please wait...");
      const res = await spotify.download(url);
      const file = res.files[0];
      const stat = await fs.stat(file);
      const maxSize = (global.settings.max_uploud || 50) * 1024 * 1024;
      if (stat.size > maxSize) {
        await spotify.cleanup(res.directory);
        throw new Error("File size exceeds the maximum limit");
      }
      await sendWithRetry(() => ctx.replyWithAudio(toInputFile(file), {
        title: res.metadata.title,
        performer: res.metadata.uploader,
        caption: buildCaption(res.metadata, "spotify"),
        ...HTML
      }));
      await spotify.cleanup(res.directory);
      return;
    }
    const downloader = global.scraper.ytdpl;
    if (!downloader) throw new Error("Downloader not available");

    let downloadOptions = {};
    let isAudioBool = false;
    if (_unified && typeof _unified.normalizeOpts === "function") {
      const norm = _unified.normalizeOpts(isAudio);


      if (norm.audioOnly) { isAudioBool = true; downloadOptions.audioOnly = true; }

      Object.assign(downloadOptions, norm);

      isAudioBool = !!downloadOptions.audioOnly;

      if (typeof isAudio === "boolean" && isAudio) { isAudioBool = true; downloadOptions.audioOnly = true; }
    } else {

      isAudioBool = !!isAudio && typeof isAudio !== "object";
      if (isAudioBool) downloadOptions.audioOnly = true;
      else if (typeof isAudio === "object" && isAudio !== null) Object.assign(downloadOptions, isAudio);
    }

    if (_unified && typeof _unified.downloadAndSendTG === "function" && Object.keys(downloadOptions).some(k => !["audioOnly","cookies"].includes(k))) {

      return _unified.downloadAndSendTG(ctx, url, downloadOptions);
    }
    const metadata = await downloader.getMetadata(url, downloadOptions);
    if (!metadata) throw new Error("Failed to get media metadata");
    let info = metadata;
    if (Array.isArray(metadata)) {
      if (metadata.length === 0) throw new Error("No results found");
      info = metadata[0];
    }
    if (!info || !info.id && !info.url) throw new Error("Invalid media data");
    const realUrl = info.webpage_url || info.url || info.original_url || url;
    const isGallery = Array.isArray(metadata) && metadata.length > 1;
    await ctx.reply("🕒 Downloading media, please wait...");

    const cookiesPath = path.join(__dirname, "../../../../../cookies.txt");
    if (!downloadOptions.cookies) {
      try { await fs.access(cookiesPath); downloadOptions.cookies = cookiesPath; } catch {}
    }
    const result = await downloader.download(realUrl, downloadOptions);
    if (!result || !result.files || result.files.length === 0) {
      throw new Error("Failed to download media");
    }
    const maxSize = (global.settings.max_uploud || 50) * 1024 * 1024;
    const validFiles = [];
    for (const file of result.files) {
      try {
        const stat = await fs.stat(file);
        if (stat.size <= maxSize) validFiles.push(file);
      } catch {}
    }
    if (validFiles.length === 0) {
      await downloader.cleanup(result.directory);
      throw new Error("All files exceed the maximum size limit");
    }
    if (isGallery && validFiles.length > 1) {
      const caption = buildCaption({
        ...info,
        _raw: metadata
      }, source);
      const mediaGroup = [];
      for (let i = 0; i < Math.min(validFiles.length, 10); i++) {
        const fileInfo = getFileInfo(validFiles[i]);
        const input = toInputFile(validFiles[i]);
        if (i === 0) {
          if (fileInfo.type === "photo") {
            mediaGroup.push({
              type: "photo",
              media: input,
              caption: caption,
              ...HTML
            });
          } else if (fileInfo.type === "video") {
            mediaGroup.push({
              type: "video",
              media: input,
              caption: caption,
              ...HTML
            });
          } else {
            mediaGroup.push({
              type: "photo",
              media: input,
              caption: caption,
              ...HTML
            });
          }
        } else {
          if (fileInfo.type === "photo") {
            mediaGroup.push({
              type: "photo",
              media: input
            });
          } else if (fileInfo.type === "video") {
            mediaGroup.push({
              type: "video",
              media: input
            });
          } else {
            mediaGroup.push({
              type: "photo",
              media: input
            });
          }
        }
      }
      if (mediaGroup.length > 0) {
        await sendWithRetry(() => ctx.replyWithMediaGroup(mediaGroup)).catch(async () => {
          for (const file of validFiles) {
            const fi = getFileInfo(file);
            const input = toInputFile(file);
            if (fi.type === "video") {
              await sendWithRetry(() => ctx.replyWithVideo(input, {
                caption: caption,
                ...HTML
              })).catch(() => {});
            } else {
              await sendWithRetry(() => ctx.replyWithPhoto(input, {
                caption: caption,
                ...HTML
              })).catch(() => {});
            }
          }
        });
      }
    } else {
      const file = validFiles[0];
      const fileInfo = getFileInfo(file);

      const _captionFn = (_unified && _unified.buildCaption) ? (i,s)=> _unified.buildCaption(i,s,{html:true}) : buildCaption;
      const caption = _captionFn(info, source);
      if (isAudioBool || fileInfo.type === "audio") {
        await sendWithRetry(() => ctx.replyWithAudio(toInputFile(file), {
          title: info.title || "Audio",
          performer: info.uploader || "Unknown",
          caption: caption,
          ...HTML
        }));
      } else if (fileInfo.type === "video") {
        await sendWithRetry(() => ctx.replyWithVideo(toInputFile(file), {
          caption: caption,
          ...HTML
        }));
      } else if (fileInfo.type === "photo") {
        await sendWithRetry(() => ctx.replyWithPhoto(toInputFile(file), {
          caption: caption,
          ...HTML
        }));
      } else {
        await sendWithRetry(() => ctx.replyWithDocument(toInputFile(file), {
          caption: caption,
          ...HTML
        }));
      }
    }
    await downloader.cleanup(result.directory);
  } catch (error) {
    await ctx.reply(global.settings.message.downloaderError.replace("{error}", error.message));
  }
}

module.exports = {
  getFileInfo: getFileInfo,
  buildCaption: buildCaption,
  detectSource: detectSource,
  downloadMedia: downloadMedia
};