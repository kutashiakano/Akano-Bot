const fs = require("fs/promises");
const path = require("path");

function getFileInfo(file) {
  const ext = path.extname(file).toLowerCase();
  const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
  const videoExts = [".mp4", ".webm", ".mov", ".mkv"];
  const audioExts = [".mp3", ".m4a", ".opus", ".wav", ".ogg"];
  if (imageExts.includes(ext)) return { type: "photo", ext };
  if (videoExts.includes(ext)) return { type: "video", ext };
  if (audioExts.includes(ext)) return { type: "audio", ext };
  return { type: "document", ext };
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
    if (duration > 0)
      lines.push(`Duration: ${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`);
    if (views > 0) lines.push(`Views: ${views.toLocaleString()}`);
    if (desc && desc.length > 0) {
      const shortDesc = desc.length > 200 ? desc.substring(0, 200) + "..." : desc;
      lines.push(`\n${shortDesc}`);
    }
  } else if (source === "search") {
    lines.push(`<b>YouTube Music</b>`);
    lines.push(`${title}`);
    if (author !== "Unknown") lines.push(`By: ${author}`);
    if (duration > 0)
      lines.push(`Duration: ${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`);
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
    if (duration > 0)
      lines.push(`Duration: ${Math.floor(duration / 60)}m ${Math.floor(duration % 60)}s`);
  } else {
    lines.push(`<b>Media Download</b>`);
    if (title && title !== "Media") lines.push(`${title}`);
    if (author !== "Unknown") lines.push(`By: ${author}`);
    if (duration > 0) lines.push(`Duration: ${Math.floor(duration)}s`);
  }

  return lines.join("\n");
}

function detectSource(url) {
  if (/tiktok\.com|vt\.tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/youtube\.com|youtu\.be|music\.youtube\.com/i.test(url)) return "youtube";
  if (/facebook\.com|fb\.watch/i.test(url)) return "facebook";
  if (/x\.com|twitter\.com/i.test(url)) return "twitter";
  if (/open\.spotify\.com|spotify\.link/i.test(url)) return "spotify";
  if (/soundcloud\.com/i.test(url)) return "soundcloud";
  return "generic";
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
      await ctx.replyWithAudio(
        { source: file },
        {
          title: res.metadata.title,
          performer: res.metadata.uploader,
          caption: buildCaption(res.metadata, "spotify"),
          parse_mode: "HTML",
        },
      );
      await spotify.cleanup(res.directory);
      return;
    }

    const downloader = global.scraper.ytdpl;
    if (!downloader) throw new Error("Downloader not available");

    const metadata = await downloader.getMetadata(url);
    if (!metadata) throw new Error("Failed to get media metadata");

    let info = metadata;
    if (Array.isArray(metadata)) {
      if (metadata.length === 0) throw new Error("No results found");
      info = metadata[0];
    }

    if (!info || (!info.id && !info.url)) throw new Error("Invalid media data");

    const realUrl = info.webpage_url || info.url || info.original_url || url;
    const isGallery = Array.isArray(metadata) && metadata.length > 1;

    await ctx.reply("🕒 Downloading media, please wait...");

    const downloadOptions = {};
    const cookiesPath = path.join(__dirname, "../../../../../cookies.txt");
    try {
      await fs.access(cookiesPath);
      downloadOptions.cookies = cookiesPath;
    } catch {}
    if (isAudio) downloadOptions.audioOnly = true;

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
      const caption = buildCaption({ ...info, _raw: metadata }, source);
      const mediaGroup = [];
      for (let i = 0; i < Math.min(validFiles.length, 10); i++) {
        const fileInfo = getFileInfo(validFiles[i]);
        if (i === 0) {
          if (fileInfo.type === "photo") {
            mediaGroup.push({
              type: "photo",
              source: validFiles[i],
              caption: caption,
              parse_mode: "HTML",
            });
          } else if (fileInfo.type === "video") {
            mediaGroup.push({
              type: "video",
              source: validFiles[i],
              caption: caption,
              parse_mode: "HTML",
            });
          } else {
            mediaGroup.push({
              type: "photo",
              source: validFiles[i],
              caption: caption,
              parse_mode: "HTML",
            });
          }
        } else {
          if (fileInfo.type === "photo") {
            mediaGroup.push({ type: "photo", source: validFiles[i] });
          } else if (fileInfo.type === "video") {
            mediaGroup.push({ type: "video", source: validFiles[i] });
          } else {
            mediaGroup.push({ type: "photo", source: validFiles[i] });
          }
        }
      }
      if (mediaGroup.length > 0) {
        await ctx.replyWithMediaGroup(mediaGroup).catch(async () => {
          for (const file of validFiles) {
            const fi = getFileInfo(file);
            if (fi.type === "video") {
              await ctx
                .replyWithVideo({ source: file }, { caption: caption, parse_mode: "HTML" })
                .catch(() => {});
            } else {
              await ctx
                .replyWithPhoto({ source: file }, { caption: caption, parse_mode: "HTML" })
                .catch(() => {});
            }
          }
        });
      }
    } else {
      const file = validFiles[0];
      const fileInfo = getFileInfo(file);
      const caption = buildCaption(info, source);

      if (isAudio || fileInfo.type === "audio") {
        await ctx.replyWithAudio(
          { source: file },
          {
            title: info.title || "Audio",
            performer: info.uploader || "Unknown",
            caption: caption,
            parse_mode: "HTML",
          },
        );
      } else if (fileInfo.type === "video") {
        await ctx.replyWithVideo({ source: file }, { caption: caption, parse_mode: "HTML" });
      } else if (fileInfo.type === "photo") {
        await ctx.replyWithPhoto({ source: file }, { caption: caption, parse_mode: "HTML" });
      } else {
        await ctx.replyWithDocument(
          { source: file, filename: path.basename(file) },
          { caption: caption, parse_mode: "HTML" },
        );
      }
    }

    await downloader.cleanup(result.directory);
  } catch (error) {
    await ctx.reply(`Error: ${error.message}`);
  }
}

module.exports = {
  getFileInfo,
  buildCaption,
  detectSource,
  downloadMedia,
};

