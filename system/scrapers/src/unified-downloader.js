


const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");
const os = require("os");


const PROVIDERS = [
  { id: "youtube", name: "YouTube", domains: ["youtube.com", "youtu.be", "music.youtube.com", "m.youtube.com", "youtube-nocookie.com"], pattern: /(?:youtube\.com|youtu\.be|music\.youtube\.com|m\.youtube\.com|youtube-nocookie\.com)/i, description: "YouTube videos, Shorts, Music, playlists", color: "#FF0000" },
  { id: "tiktok", name: "TikTok", domains: ["tiktok.com", "vt.tiktok.com", "vm.tiktok.com", "m.tiktok.com"], pattern: /tiktok\.com|vt\.tiktok\.com|vm\.tiktok\.com|m\.tiktok\.com/i, description: "TikTok videos & photo carousels (yt-dlp + tikwm fallback)", color: "#000000" },
  { id: "instagram", name: "Instagram", domains: ["instagram.com"], pattern: /instagram\.com/i, description: "Instagram posts, reels, carousels (gallery-dl)", color: "#E4405F" },
  { id: "facebook", name: "Facebook", domains: ["facebook.com", "fb.watch", "fb.com", "m.facebook.com"], pattern: /facebook\.com|fb\.watch|fb\.com/i, description: "Facebook videos & reels", color: "#1877F2" },
  { id: "twitter", name: "Twitter / X", domains: ["twitter.com", "x.com", "t.co"], pattern: /(?:twitter\.com|x\.com|t\.co)/i, description: "X (Twitter) videos & photos", color: "#1DA1F2" },
  { id: "soundcloud", name: "SoundCloud", domains: ["soundcloud.com"], pattern: /soundcloud\.com/i, description: "SoundCloud tracks & playlists", color: "#FF3300" },
  { id: "pinterest", name: "Pinterest", domains: ["pinterest.com", "pin.it"], pattern: /pinterest\.com|pin\.it/i, description: "Pinterest pins (gallery-dl)", color: "#E60023" },
  { id: "reddit", name: "Reddit", domains: ["reddit.com", "redd.it", "v.redd.it"], pattern: /reddit\.com|redd\.it|v\.redd\.it/i, description: "Reddit videos & galleries", color: "#FF4500" },
  { id: "twitch", name: "Twitch", domains: ["twitch.tv", "clips.twitch.tv"], pattern: /twitch\.tv/i, description: "Twitch VODs & clips", color: "#6441A5" },
  { id: "vimeo", name: "Vimeo", domains: ["vimeo.com"], pattern: /vimeo\.com/i, description: "Vimeo videos", color: "#1AB7EA" },
  { id: "dailymotion", name: "Dailymotion", domains: ["dailymotion.com", "dai.ly"], pattern: /dailymotion\.com|dai\.ly/i, description: "Dailymotion videos", color: "#00AFF0" },
  { id: "kick", name: "Kick", domains: ["kick.com"], pattern: /kick\.com/i, description: "Kick streams", color: "#53FC18" },
  { id: "streamable", name: "Streamable", domains: ["streamable.com"], pattern: /streamable\.com/i, description: "Streamable clips", color: "#0F90FA" },
  { id: "rumble", name: "Rumble", domains: ["rumble.com"], pattern: /rumble\.com/i, description: "Rumble videos", color: "#85CC00" },
  { id: "odysee", name: "Odysee", domains: ["odysee.com"], pattern: /odysee\.com/i, description: "Odysee / LBRY", color: "#EF1970" },
  { id: "bilibili", name: "Bilibili", domains: ["bilibili.com", "b23.tv"], pattern: /bilibili\.com|b23\.tv/i, description: "Bilibili videos", color: "#00A1D6" },
  { id: "niconico", name: "Niconico", domains: ["nicovideo.jp", "niconico.jp"], pattern: /nicovideo\.jp|niconico\.jp/i, description: "Niconico videos", color: "#252525" },
  { id: "vk", name: "VK", domains: ["vk.com", "vkvideo.ru"], pattern: /vk\.com|vkvideo\.ru/i, description: "VK videos", color: "#0077FF" },
  { id: "okru", name: "OK.ru", domains: ["ok.ru"], pattern: /ok\.ru/i, description: "OK.ru videos", color: "#EE8208" },
  { id: "rutube", name: "Rutube", domains: ["rutube.ru"], pattern: /rutube\.ru/i, description: "Rutube videos", color: "#04005A" },
  { id: "tumblr", name: "Tumblr", domains: ["tumblr.com"], pattern: /tumblr\.com/i, description: "Tumblr media", color: "#35465C" },
  { id: "snapchat", name: "Snapchat", domains: ["snapchat.com", "snap.com"], pattern: /snapchat\.com|snap\.com/i, description: "Snapchat stories", color: "#FFFC00" },
  { id: "linkedin", name: "LinkedIn", domains: ["linkedin.com"], pattern: /linkedin\.com/i, description: "LinkedIn videos", color: "#0077B5" },
  { id: "threads", name: "Threads", domains: ["threads.net"], pattern: /threads\.net/i, description: "Threads videos", color: "#000000" },
  { id: "likee", name: "Likee", domains: ["likee.video", "likee.com"], pattern: /likee\.(?:video|com)/i, description: "Likee videos", color: "#FF2D55" },
  { id: "kwai", name: "Kwai", domains: ["kwai.com", "kuaishou.com"], pattern: /kwai\.com|kuaishou\.com/i, description: "Kwai / Kuaishou", color: "#FE5000" },
  { id: "douyin", name: "Douyin", domains: ["douyin.com", "iesdouyin.com"], pattern: /douyin\.com|iesdouyin\.com/i, description: "Douyin videos", color: "#010101" },
  { id: "mixcloud", name: "Mixcloud", domains: ["mixcloud.com"], pattern: /mixcloud\.com/i, description: "Mixcloud mixes", color: "#5000FF" },
  { id: "bandcamp", name: "Bandcamp", domains: ["bandcamp.com"], pattern: /bandcamp\.com/i, description: "Bandcamp tracks", color: "#629AA9" },
  { id: "9gag", name: "9GAG", domains: ["9gag.com"], pattern: /9gag\.com/i, description: "9GAG videos", color: "#000000" },
  { id: "apple", name: "Apple Trailers / Music", domains: ["trailers.apple.com", "music.apple.com"], pattern: /(?:trailers|music)\.apple\.com/i, description: "Apple trailers & music previews", color: "#000000" },
  { id: "spotify", name: "Spotify", domains: ["open.spotify.com", "spotify.link"], pattern: /open\.spotify\.com|spotify\.link/i, description: "Spotify via spotidown / yt-dlp (fallback)", color: "#1DB954" },
  { id: "twitcasting", name: "TwitCasting", domains: ["twitcasting.tv"], pattern: /twitcasting\.tv/i, description: "TwitCasting lives", color: "#00A8E8" },
  { id: "telegram", name: "Telegram", domains: ["t.me"], pattern: /t\.me\//i, description: "Telegram public media (generic handling)", color: "#26A5E4" },
  { id: "generic", name: "Generic", domains: [], pattern: /.*/, description: "Generic yt-dlp extractor — covers remaining ~1700 sites (see yt-dlp --list-extractors)", color: "#5865F2" }
];


const PROVIDER_MAP = Object.fromEntries(PROVIDERS.map(p => [p.id, p]));
const SUPPORTED_SOURCES = PROVIDERS.map(p => p.id);
const EXTRACTOR_COUNT = 1752;


const SUPPORTED_PROVIDERS = SUPPORTED_SOURCES;


function detectSource(url = "") {
  const str = String(url || "").trim();
  if (!str) return "generic";
  let hostname = "";
  try {
    const u = new URL(str.startsWith("http") ? str : `https://${str}`);
    hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    hostname = "";
  }
  if (hostname) {
    for (const p of PROVIDERS) {
      if (p.id === "generic") continue;
      for (const d of p.domains) {
        const dom = d.toLowerCase().replace(/^www\./, "");
        if (hostname === dom || hostname.endsWith(`.${dom}`)) return p.id;
      }
    }

    for (const p of PROVIDERS) {
      if (p.id === "generic") continue;
      if (p.id === "twitter") {
        if (/(?:^|https?:\/\/)(?:www\.)?(?:twitter\.com|x\.com)(?:\/|$|\?|#)/i.test(str) || /(?:^|https?:\/\/)t\.co(?:\/|$|\?|#)/i.test(str)) return "twitter";
        continue;
      }
      if (p.pattern.test(str)) return p.id;
    }
    return "generic";
  }

  for (const p of PROVIDERS) {
    if (p.id === "generic") continue;
    if (p.id === "twitter") {
      if (/(?:twitter\.com|x\.com|t\.co)(?:\/|$|\?|#)/i.test(str)) return "twitter";
      continue;
    }
    if (p.pattern.test(str)) return p.id;
  }
  return "generic";
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  if (s <= 0) return "0:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

function getFileInfo(file) {
  const ext = path.extname(String(file || "")).toLowerCase();
  const imageExts = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg", ".heic"];
  const videoExts = [".mp4", ".webm", ".mov", ".mkv", ".avi", ".flv", ".m4v", ".3gp", ".ts", ".mts"];
  const audioExts = [".mp3", ".m4a", ".opus", ".wav", ".ogg", ".flac", ".aac", ".wma", ".aiff", ".alac", ".vorbis"];
  const subExts = [".srt", ".vtt", ".ass", ".lrc", ".ssa"];
  if (imageExts.includes(ext)) return { type: "photo", ext, kind: "image" };
  if (videoExts.includes(ext)) return { type: "video", ext, kind: "video" };
  if (audioExts.includes(ext)) return { type: "audio", ext, kind: "audio" };
  if (subExts.includes(ext)) return { type: "subtitle", ext, kind: "subtitle" };
  if ([".json", ".description", ".info.json"].some(x => String(file).endsWith(x))) return { type: "metadata", ext, kind: "metadata" };
  return { type: "document", ext, kind: "document" };
}


function buildCaption(info = {}, source = "generic", opts = {}) {
  const html = opts.html === true;
  const b = html ? ["<b>", "</b>"] : ["*", "*"];
  const maxDesc = opts.maxDesc || 300;
  const lines = [];
  const title = info.title || info.fulltitle || info.description || info.alt_title || (info._type === "photo" ? "Image" : "Media");
  const author = info.uploader || info.channel || info.creator || info.artist || info.uploader_id || "Unknown";
  const desc = info.description || info.caption || "";
  const duration = info.duration || 0;
  const views = info.view_count || info.viewCount || 0;
  const likes = info.like_count || 0;
  const uploadDate = info.upload_date || info.release_date || "";

  const push = (label, value) => { if (value && value !== "Unknown") lines.push(`${label}: ${value}`); };


  if (source === "tiktok") {
    lines.push(`${b[0]}TikTok ${info._type === "photo" ? "Slide" : "Video"}${b[1]}`);
    if (author !== "Unknown") lines.push(`${b[0]}By:${b[1]} ${author}`);
    if (duration) lines.push(`${b[0]}Duration:${b[1]} ${formatDuration(duration)}`);
    if (desc) lines.push(html ? `\n${desc.slice(0, maxDesc)}` : `\n${desc.slice(0, maxDesc)}`);
  } else if (source === "instagram") {
    const isCarousel = Array.isArray(info._raw) && info._raw.length > 1;
    lines.push(`${b[0]}Instagram ${isCarousel ? `Carousel (${info._raw.length} items)` : "Post"}${b[1]}`);
    if (author !== "Unknown") lines.push(`${b[0]}By:${b[1]} ${author}`);
    if (desc) lines.push(html ? `\n${desc.slice(0, maxDesc)}` : `\n${desc.slice(0, maxDesc)}`);
  } else if (source === "youtube") {
    const kind = duration > 0 ? (duration < 65 ? "Short" : "Video") : "Video";
    lines.push(`${b[0]}YouTube ${kind}${b[1]}`);
    lines.push(`${b[0]}${title}${b[1]}`);
    if (author !== "Unknown") lines.push(`${b[0]}By:${b[1]} ${author}`);
    if (duration) lines.push(`${b[0]}Duration:${b[1]} ${formatDuration(duration)}`);
    if (views) lines.push(`${b[0]}Views:${b[1]} ${Number(views).toLocaleString()}`);
    if (likes) lines.push(`${b[0]}Likes:${b[1]} ${Number(likes).toLocaleString()}`);
    if (uploadDate) { const y = String(uploadDate).slice(0,4), m = String(uploadDate).slice(4,6), d = String(uploadDate).slice(6,8); if(y) lines.push(`${b[0]}Uploaded:${b[1]} ${y}-${m}-${d}`); }
    if (desc) { const short = desc.length > maxDesc ? desc.slice(0, maxDesc) + "..." : desc; lines.push(`\n${short}`); }
  } else if (source === "facebook") {
    lines.push(`${b[0]}Facebook Video${b[1]}`);
    if (title && title !== "Unknown" && title !== "Media") lines.push(`${b[0]}${title}${b[1]}`);
    if (author !== "Unknown") lines.push(`${b[0]}By:${b[1]} ${author}`);
    if (duration) lines.push(`${b[0]}Duration:${b[1]} ${formatDuration(duration)}`);
  } else if (source === "twitter") {
    lines.push(`${b[0]}Twitter / X ${info._type === "photo" ? "Media" : "Video"}${b[1]}`);
    if (author !== "Unknown") lines.push(`${b[0]}By:${b[1]} ${author}`);
    if (desc) lines.push(`\n${desc.slice(0, maxDesc)}`);
    if (duration) lines.push(`${b[0]}Duration:${b[1]} ${formatDuration(duration)}`);
  } else if (source === "soundcloud") {
    lines.push(`${b[0]}SoundCloud${b[1]}`);
    lines.push(`${b[0]}${title}${b[1]}`);
    if (author !== "Unknown") lines.push(`${b[0]}Artist:${b[1]} ${author}`);
    if (duration) lines.push(`${b[0]}Duration:${b[1]} ${formatDuration(duration)}`);
  } else if (source === "pinterest") {
    lines.push(`${b[0]}Pinterest Pin${b[1]}`);
    if (author !== "Unknown") lines.push(`${b[0]}By:${b[1]} ${author}`);
    if (desc) { const short = desc.length > maxDesc ? desc.slice(0, maxDesc)+"..." : desc; lines.push(`\n${short}`); }
  } else if (source === "reddit") {
    lines.push(`${b[0]}Reddit Media${b[1]}`);
    if (title && title !== "Media") lines.push(`${b[0]}${title}${b[1]}`);
    if (author !== "Unknown") lines.push(`${b[0]}By:${b[1]} u/${author}`);
    if (desc) lines.push(`\n${desc.slice(0, maxDesc)}`);
  } else if (source === "twitch") {
    lines.push(`${b[0]}Twitch ${info.is_live ? "Stream" : "VOD"}${b[1]}`);
    lines.push(`${b[0]}${title}${b[1]}`);
    if (author !== "Unknown") lines.push(`${b[0]}Channel:${b[1]} ${author}`);
    if (duration) lines.push(`${b[0]}Duration:${b[1]} ${formatDuration(duration)}`);
  } else if (source === "vimeo") {
    lines.push(`${b[0]}Vimeo${b[1]}`);
    lines.push(`${b[0]}${title}${b[1]}`);
    if (author !== "Unknown") lines.push(`${b[0]}By:${b[1]} ${author}`);
    if (duration) lines.push(`${b[0]}Duration:${b[1]} ${formatDuration(duration)}`);
  } else if (source === "dailymotion") {
    lines.push(`${b[0]}Dailymotion${b[1]}`);
    lines.push(`${b[0]}${title}${b[1]}`);
    if (author !== "Unknown") lines.push(`${b[0]}By:${b[1]} ${author}`);
  } else if (source === "spotify") {
    lines.push(`${b[0]}Spotify${b[1]}`);
    lines.push(`${b[0]}${title}${b[1]}`);
    if (author !== "Unknown") lines.push(`${b[0]}Artist:${b[1]} ${author}`);
    if (duration) lines.push(`${b[0]}Duration:${b[1]} ${formatDuration(duration)}`);
    if (info.album) lines.push(`${b[0]}Album:${b[1]} ${info.album}`);
  } else {

    const pretty = PROVIDER_MAP[source]?.name || (source.charAt(0).toUpperCase()+source.slice(1));
    const isGeneric = source === "generic";
    lines.push(`${b[0]}${isGeneric ? "Media Download" : pretty}${b[1]}`);
    if (title && title !== "Media") lines.push(`${b[0]}${title}${b[1]}`);
    if (author !== "Unknown") lines.push(`${b[0]}By:${b[1]} ${author}`);
    if (duration) lines.push(`${b[0]}Duration:${b[1]} ${formatDuration(duration)}`);
    if (views) lines.push(`${b[0]}Views:${b[1]} ${Number(views).toLocaleString()}`);
    if (desc) { const short = desc.length > maxDesc ? desc.slice(0, maxDesc)+"..." : desc; lines.push(`\n${short}`); }
  }
  return lines.join("\n").trim();
}


function buildEmbed(info, source, interaction, opts = {}) {
  const title = info.title || info.description || "Media";
  const author = info.uploader || info.channel || info.creator || "Unknown";
  const desc = info.description || "";
  const duration = info.duration || 0;
  const views = info.view_count || 0;
  const thumbnail = info.thumbnail || info.thumbnails?.[info.thumbnails.length-1]?.url || "";
  const EBuilder = interaction?.client?.ebuilder || opts.EBuilder;
  if (!EBuilder) throw new Error("buildEmbed requires discord.js EmbedBuilder (pass interaction.client.ebuilder or opts.EBuilder)");
  const embed = new EBuilder().setColor(PROVIDER_MAP[source]?.color || "#5865F2").setTimestamp();
  if (opts.requestedBy) embed.setFooter({ text: `Requested by ${opts.requestedBy}` });
  else if (interaction?.user?.username) embed.setFooter({ text: `Requested by ${interaction.user.username}` });

  if (source === "youtube") {
    embed.setTitle(`YouTube ${duration>0 ? "Video" : "Short"}`).setDescription(`**${title}**`);
    if (author!=="Unknown") embed.addFields({ name:"Author", value: author, inline:true });
    if (duration) embed.addFields({ name:"Duration", value:`\`${formatDuration(duration)}\``, inline:true });
    if (views) embed.addFields({ name:"Views", value: views.toLocaleString(), inline:true });
  } else if (source === "tiktok") {
    embed.setTitle(`TikTok ${info._type==="photo" ? "Slide" : "Video"}`);
    if (author!=="Unknown") embed.addFields({ name:"Author", value: author, inline:true });
    if (duration) embed.addFields({ name:"Duration", value:`\`${formatDuration(duration)}\``, inline:true });
  } else if (source === "instagram") {
    const isCarousel = Array.isArray(info._raw) && info._raw.length>1;
    embed.setTitle(`Instagram ${isCarousel ? `Carousel (${info._raw.length} items)` : "Post"}`);
    if (author!=="Unknown") embed.addFields({ name:"Author", value: author, inline:true });
  } else if (source === "spotify") {
    embed.setTitle("Spotify Track").setDescription(`**${title}**`);
    if (author!=="Unknown") embed.addFields({ name:"Artist", value: author, inline:true });
    if (duration) embed.addFields({ name:"Duration", value:`\`${formatDuration(duration)}\``, inline:true });
  } else {
    const pretty = PROVIDER_MAP[source]?.name || "Media";
    embed.setTitle(`${pretty} Download`);
    if (title && title!=="Media") embed.setDescription(`**${title}**`);
    if (author!=="Unknown") embed.addFields({ name:"Author", value: author, inline:true });
    if (duration) embed.addFields({ name:"Duration", value:`\`${formatDuration(duration)}\``, inline:true });
  }
  if (desc && opts.includeDesc !== false) {
    const short = desc.length>400 ? desc.slice(0,400)+"..." : desc;
    if (short) embed.addFields({ name:"Description", value: short });
  }
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (opts.url) embed.setURL(opts.url);
  return embed;
}


function normalizeOpts(input) {
  if (input === true) return { audioOnly: true };
  if (input === false || input == null) return {};
  if (typeof input === "string") {

    return parseCliFlags(input);
  }
  if (typeof input !== "object") return {};
  const o = { ...input };

  if (o.audioOnly === undefined && o.audio_only !== undefined) o.audioOnly = o.audio_only;
  if (o.audioOnly === undefined && o.extractAudio !== undefined) o.audioOnly = !!o.extractAudio;
  if (o.audioOnly === undefined && o.audio !== undefined) o.audioOnly = !!o.audio;
  if (o.audioOnly === undefined && o.mp3 !== undefined) o.audioOnly = !!o.mp3;
  if (o.audioOnly === undefined && o.music !== undefined) o.audioOnly = !!o.music;

  if (typeof o.audioOnly === "string") o.audioOnly = o.audioOnly !== "false" && o.audioOnly !== "0";

  delete o.audio; delete o.mp3; delete o.music;
  if (o.audioFormat === undefined && o.audio_format !== undefined) o.audioFormat = o.audio_format;
  if (o.audio_format && !o.audioFormat) o.audioFormat = o.audio_format;
  if (o.audioQuality === undefined && o.audio_quality !== undefined) o.audioQuality = o.audio_quality;
  if (o.embedThumbnail === undefined && o.embed_thumbnail !== undefined) o.embedThumbnail = o.embed_thumbnail;
  if (o.embedMetadata === undefined && o.embed_metadata !== undefined) o.embedMetadata = o.embed_metadata;
  if (o.embedChapters === undefined && o.embed_chapters !== undefined) o.embedChapters = o.embed_chapters;
  if (o.embedSubs === undefined && o.embed_subs !== undefined) o.embedSubs = o.embed_subs;
  if (o.writeSubs === undefined && o.write_subs !== undefined) o.writeSubs = o.write_subs;
  if (o.writeAutoSubs === undefined && (o.write_auto_subs!==undefined || o.writeAutomaticSubs!==undefined)) o.writeAutoSubs = o.write_auto_subs ?? o.writeAutomaticSubs;
  if (o.subLangs === undefined && (o.sub_langs!==undefined || o.subLangs!==undefined)) o.subLangs = o.sub_langs ?? o.subLangs;
  if (o.convertSubs === undefined && o.convert_subs!==undefined) o.convertSubs = o.convert_subs;
  if (o.writeThumbnail === undefined && o.write_thumbnail!==undefined) o.writeThumbnail = o.write_thumbnail;
  if (o.convertThumbnails === undefined && o.convert_thumbnails!==undefined) o.convertThumbnails = o.convert_thumbnails;
  if (o.formatSort === undefined && (o.format_sort!==undefined || o["format-sort"]!==undefined)) o.formatSort = o.format_sort ?? o["format-sort"];
  if (o.downloadSections === undefined && (o.download_sections!==undefined || o["download-sections"]!==undefined)) o.downloadSections = o.download_sections ?? o["download-sections"];
  if (o.extractorArgs === undefined && (o.extractor_args!==undefined || o["extractor-args"]!==undefined)) o.extractorArgs = o.extractor_args ?? o["extractor-args"];
  if (o.cookiesFromBrowser === undefined && o.cookies_from_browser!==undefined) o.cookiesFromBrowser = o.cookies_from_browser;
  if (o.cookies === undefined && o.cookieFile!==undefined) o.cookies = o.cookieFile;
  if (o.filenameFormat === undefined && (o.outputTemplate!==undefined || o.output_template!==undefined || o.output!==undefined)) o.filenameFormat = o.outputTemplate ?? o.output_template ?? o.output;
  if (o.limitRate === undefined && o.limit_rate!==undefined) o.limitRate = o.limit_rate;
  if (o.maxFilesize === undefined && o.max_filesize!==undefined) o.maxFilesize = o.max_filesize;
  if (o.sleepRequest === undefined && o.sleep_requests!==undefined) o.sleepRequest = o.sleep_requests;

  if (o.extraArgs === undefined && o.ytDlpArgs!==undefined) o.extraArgs = o.ytDlpArgs;
  if (o.extraArgs === undefined && o.rawArgs!==undefined) o.extraArgs = o.rawArgs;
  if (o.extraArgs === undefined && o.yt_dlp_args!==undefined) o.extraArgs = o.yt_dlp_args;
  return o;
}


function parseCliFlags(str = "") {
  const tokens = String(str).match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  const out = {};
  const toCamel = s => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  let i = 0;
  while (i < tokens.length) {
    let tok = tokens[i].replace(/^["']|["']$/g, "");
    if (tok.startsWith("--")) {
      const rawKey = tok.slice(2);
      const key = toCamel(rawKey);
      const next = tokens[i+1] ? tokens[i+1].replace(/^["']|["']$/g, "") : null;
      if (next == null || next.startsWith("-")) {
        out[key] = true; i += 1;
      } else {

        const arrayFlags = new Set(["downloadSections","extractorArgs","addHeaders","matchFilters","breakMatchFilters","postprocessorArgs","parseMetadata","replaceInMetadata","removeChapters","exec","alias","downloader","downloaderArgs","remoteComponents","paths","subLangs"]);
        if (arrayFlags.has(key)) {
          if (!out[key]) out[key] = [];
          out[key].push(next);
        } else {
          out[key] = next;
        }
        i += 2;
      }
    } else if (tok.startsWith("-") && tok.length === 2) {

      const map = { f:"format", S:"formatSort", o:"output", I:"playlistItems", N:"concurrentFragments", r:"limitRate", R:"retries", a:"batchFile", P:"paths", t:"presetAlias", x:"extractAudio", k:"keepVideo", j:"dumpJson", s:"simulate", q:"quiet", v:"verbose", F:"listFormats", J:"dumpSingleJson" };
      const k = map[tok[1]];
      if (k) {
        const next = tokens[i+1] ? tokens[i+1].replace(/^["']|["']$/g, "") : null;
        if (next && !next.startsWith("-")) { out[k]=next; i+=2; } else { out[k]=true; i+=1; }
      } else { i+=1; }
    } else { i+=1; }
  }

  return normalizeOpts(out);
}


function _getDownloader() {
  try { if (global.scraper?.ytdpl) return global.scraper.ytdpl; } catch {}
  try { return require("./ytdpl"); } catch (e) { throw new Error("ytdpl downloader not available: " + e.message); }
}


async function download(url, opts = {}) {
  if (!url || typeof url !== "string" || !/^https?:\/\//i.test(url.trim())) throw new Error("Invalid URL");
  const cleanUrl = url.trim().replace(/[.,!?;:]+$/, "");
  const normalized = normalizeOpts(opts);
  const source = detectSource(cleanUrl);
  const dl = _getDownloader();

  if (!normalized.cookies) {
    const candidates = [
      path.join(__dirname, "../../../cookies.txt"),
      path.join(__dirname, "../../../../../cookies.txt"),
      path.join(process.cwd(), "cookies.txt"),
    ];
    for (const p of candidates) { try { await fs.access(p); normalized.cookies = p; break; } catch {} }
  }
  const infoRaw = await dl.getMetadata(cleanUrl, normalized).catch(()=>null);
  let info = null;
  if (Array.isArray(infoRaw)) info = infoRaw[0] || null;
  else if (infoRaw && typeof infoRaw==="object") info = infoRaw;

  const result = await dl.download(cleanUrl, normalized);
  if (!result || !result.files) throw new Error("Download returned no files");
  return { directory: result.directory, files: result.files, info, source, rawInfo: infoRaw };
}

async function getMetadata(url, opts = {}) {
  const dl = _getDownloader();
  return dl.getMetadata(url, normalizeOpts(opts));
}

async function search(q, opts = {}) {
  const dl = _getDownloader();
  if (typeof dl.search === "function") return dl.search(q, opts);

  return dl.getMetadata(`ytsearch${opts.limit||5}:${q}`, opts);
}


async function listExtractors(opts = {}) { return _getDownloader().listExtractors(opts); }
async function extractorDescriptions(opts = {}) {
  const dl = _getDownloader();
  if (typeof dl.extractorDescriptions === "function") return dl.extractorDescriptions(opts);
  if (typeof dl.getExtractorDescriptions === "function") return dl.getExtractorDescriptions(opts);
  return {};
}
async function listFormats(url, opts={}) { return _getDownloader().listFormats(url, normalizeOpts(opts)); }
async function listSubs(url, opts={}) { return _getDownloader().listSubs(url, normalizeOpts(opts)); }
async function listThumbnails(url, opts={}) {
  const dl = _getDownloader();
  if (typeof dl.listThumbnails === "function") return dl.listThumbnails(url, normalizeOpts(opts));
  return "";
}
async function getHelp(){ return _getDownloader().getHelp(); }


async function downloadAndSend(ctx, url, opts = {}) {
  if (!ctx) throw new Error("downloadAndSend: ctx/platform required");

  if (typeof ctx === "string" && typeof url === "object") {
    return downloadAndSend(url, ctx);
  }
  if (typeof ctx === "string" && /^https?:\/\//i.test(ctx)) {

    return download(ctx, url);
  }
  const normalized = normalizeOpts(opts);

  const platformHint = ctx?.platform || ctx?.__platform || null;
  if (platformHint === "whatsapp" || platformHint === "wa") return downloadAndSendWA(ctx.sock || ctx.client || ctx, ctx.m || ctx.message || ctx, url, normalized);
  if (platformHint === "telegram" || platformHint === "tg") return downloadAndSendTG(ctx.ctx || ctx, url, normalized);
  if (platformHint === "discord" || platformHint === "dc") return downloadAndSendDC(ctx.interaction || ctx, url, normalized);

  if (ctx?.sock && ctx?.m) return downloadAndSendWA(ctx.sock, ctx.m, url, normalized);
  if (ctx?.m?.key && ctx?.sock) return downloadAndSendWA(ctx.sock, ctx.m, url, normalized);
  if (ctx?.interaction || (ctx?.user && ctx?.reply && ctx?.options)) return downloadAndSendDC(ctx.interaction || ctx, url, normalized);
  if (ctx?.replyWithVideo || ctx?.replyWithPhoto || ctx?.api || ctx?.telegram) return downloadAndSendTG(ctx, url, normalized);
  if (ctx?.chat && ctx?.reply && ctx?.from) return downloadAndSendTG(ctx, url, normalized);
  throw new Error("downloadAndSend: unable to detect platform from ctx (pass {platform:'wa'|'tg'|'dc', ...})");
}


async function downloadAndSendWA(sock, m, url, opts = {}) {
  if (!sock) throw new Error("downloadAndSendWA: sock required");
  if (!url) throw new Error("downloadAndSendWA: url required");
  const normalized = normalizeOpts(opts);
  const source = detectSource(url);
  const isAudio = !!normalized.audioOnly || !!normalized.extractAudio;

  const { files, directory, info } = await download(url, normalized);
  const dl = _getDownloader();
  try {
    const chatId = m.chat || m.key?.remoteJid || m.jid || m?.chatId;
    if (!chatId) throw new Error("Cannot determine chat id from message");
    const caption = buildCaption(info || {}, source, { html:false });
    const maxSize = (global.settings?.max_uploud || 50) * 1024 * 1024;

    const isGallery = files.length > 1;
    const sendFile = sock.sendFile || sock.sendMessage || null;


    const doSend = async (file) => {
      const ext = path.extname(file).toLowerCase();
      const fi = getFileInfo(file);
      if (isAudio || fi.type==="audio") {
        if (sendFile) return sendFile(chatId, file, path.basename(file), caption, m);
        return sock.sendMessage(chatId, { audio: fsSync.readFileSync(file), mimetype: "audio/mpeg", caption }, { quoted: m });
      } else if (fi.type==="video") {
        if (sendFile) return sendFile(chatId, file, path.basename(file), caption, m);
        return sock.sendMessage(chatId, { video: fsSync.readFileSync(file), caption }, { quoted: m });
      } else if (fi.type==="photo") {
        if (sendFile) return sendFile(chatId, file, path.basename(file), caption, m);
        return sock.sendMessage(chatId, { image: fsSync.readFileSync(file), caption }, { quoted: m });
      } else {
        if (sendFile) return sendFile(chatId, file, path.basename(file), caption, m);
        return sock.sendMessage(chatId, { document: fsSync.readFileSync(file), fileName: path.basename(file), caption }, { quoted: m });
      }
    };


    const valid = [];
    for (const f of files) { try { const st = await fs.stat(f); if (st.size <= maxSize) valid.push(f); } catch {} }
    if (valid.length===0) throw new Error("All files exceed maximum upload size");

    if (isGallery && valid.length>1) {

      if (typeof sock.sndAlb === "function") {
        const medias = valid.slice(0,10).map(f=>{
          const fi = getFileInfo(f);
          const type = fi.type==="video" ? "video" : fi.type==="photo" ? "image" : "document";
          return { type, data:{ url:f } };
        });
        await sock.sndAlb(chatId, medias, { quoted: m, caption });
      } else {
        for (let i=0;i<Math.min(valid.length,10);i++){
          const c = i===0 ? caption : "";
          const f = valid[i];
          const fi = getFileInfo(f);
          if (fi.type==="video") await (sendFile ? sendFile(chatId, f, path.basename(f), c, m) : sock.sendMessage(chatId, { video: fsSync.readFileSync(f), caption:c }, { quoted:m }));
          else if (fi.type==="photo") await (sendFile ? sendFile(chatId, f, path.basename(f), c, m) : sock.sendMessage(chatId, { image: fsSync.readFileSync(f), caption:c }, { quoted:m }));
          else await doSend(f);
        }
      }
    } else {
      await doSend(valid[0]);
    }
    return { files: valid, directory, info, source };
  } finally {
    try { await _getDownloader().cleanup(directory); } catch {}
  }
}


async function downloadAndSendTG(ctx, url, opts = {}) {
  if (!ctx) throw new Error("downloadAndSendTG: ctx required");
  if (!url) throw new Error("downloadAndSendTG: url required");
  const normalized = normalizeOpts(opts);
  const source = detectSource(url);
  const isAudio = !!normalized.audioOnly;

  let toInputFile=null;
  let HTML={ parse_mode:"HTML" };

  try { const g = require("grammy"); toInputFile = (p)=> new g.InputFile(p); } catch { try{ const {InputFile}=require("@grammyjs/files"); toInputFile = (p)=> new InputFile(p);} catch{ toInputFile = (p)=> ({ source:p }); } }

  const { files, directory, info } = await download(url, normalized);
  const dl = _getDownloader();
  try {
    const maxSize = (global.settings?.max_uploud || 50) * 1024 * 1024;
    const valid=[];
    for(const f of files){ try{ const st=await fs.stat(f); if(st.size<=maxSize) valid.push(f);}catch{}}
    if(valid.length===0) throw new Error("All files exceed Telegram limit");
    const caption = buildCaption(info||{}, source, { html:true });
    const isGallery = valid.length>1;
    const sendWithRetry = async (fn, tries=3)=>{
      let last; for(let i=1;i<=tries;i++){ try{ return await fn(); } catch(e){ last=e; const msg=String(e?.message||e); if(/429|retry after/i.test(msg)) await new Promise(r=>setTimeout(r,10000)); else if(!/hang up|timeout|ECONN|EPIPE|EAI_AGAIN|fetch failed|network/i.test(msg)) throw e; await new Promise(r=>setTimeout(r, i*3000)); } } throw last;
    };
    if (isGallery) {
      const mediaGroup = [];
      for(let i=0;i<Math.min(valid.length,10);i++){
        const fi=getFileInfo(valid[i]);
        const inp = toInputFile(valid[i]);
        const base = fi.type==="photo" ? { type:"photo", media:inp } : fi.type==="video" ? { type:"video", media:inp } : { type:"document", media:inp };
        if(i===0) base.caption=caption, base.parse_mode="HTML";
        mediaGroup.push(base);
      }
      if(mediaGroup.length){
        try { await sendWithRetry(()=> ctx.replyWithMediaGroup(mediaGroup)); }
        catch{
          for(const f of valid){
            const fi=getFileInfo(f); const inp=toInputFile(f);
            if(fi.type==="video") await sendWithRetry(()=> ctx.replyWithVideo(inp, { caption, ...HTML })).catch(()=>{});
            else if(fi.type==="photo") await sendWithRetry(()=> ctx.replyWithPhoto(inp, { caption, ...HTML })).catch(()=>{});
            else await sendWithRetry(()=> ctx.replyWithDocument(inp, { caption, ...HTML })).catch(()=>{});
          }
        }
      }
    } else {
      const file=valid[0]; const fi=getFileInfo(file);
      if(isAudio || fi.type==="audio") await sendWithRetry(()=> ctx.replyWithAudio(toInputFile(file), { title:info?.title||"Audio", performer:info?.uploader||"Unknown", caption, ...HTML }));
      else if(fi.type==="video") await sendWithRetry(()=> ctx.replyWithVideo(toInputFile(file), { caption, ...HTML }));
      else if(fi.type==="photo") await sendWithRetry(()=> ctx.replyWithPhoto(toInputFile(file), { caption, ...HTML }));
      else await sendWithRetry(()=> ctx.replyWithDocument(toInputFile(file), { caption, ...HTML }));
    }
    return { files:valid, directory, info, source };
  } finally { try{ await dl.cleanup(directory);}catch{} }
}


async function downloadAndSendDC(interaction, url, opts = {}) {
  if (!interaction) throw new Error("downloadAndSendDC: interaction required");
  if (!url) throw new Error("downloadAndSendDC: url required");
  const normalized = normalizeOpts(opts);
  const source = detectSource(url);
  const isAudio = !!normalized.audioOnly;
  let defer = false;
  try { await interaction.deferReply(); defer=true; } catch{}
  const dl = _getDownloader();
  const { files, directory, info } = await download(url, normalized);
  try {
    const maxSize = 8 * 1024 * 1024;

    const compressAudio = async (file, max)=>{
      return new Promise(resolve=>{
        const ext=path.extname(file).toLowerCase();
        if(![".mp3",".m4a",".opus",".wav",".ogg",".aac"].includes(ext)) return resolve(null);
        const tmpOut=path.join(os.tmpdir(), `akano_${Date.now()}_${Math.random().toString(36).slice(2,8)}.mp3`);
        const { execFile } = require("child_process");
        execFile("ffmpeg", ["-y","-i", file,"-b:a","64k","-ac","1", tmpOut], { timeout:120000 }, async err=>{
          if(err) return resolve(null);
          try{ const st=await fs.stat(tmpOut); if(st.size>0 && st.size<=max) return resolve(tmpOut); }catch{}
          await fs.unlink(tmpOut).catch(()=>{});
          resolve(null);
        });
      });
    };
    const cFiles=[];
    const valid=[];
    for(const f of files){
      try{
        const st=await fs.stat(f);
        if(st.size<=maxSize) valid.push(f);
        else if(isAudio){ const c=await compressAudio(f, maxSize); if(c){ valid.push(c); cFiles.push(c); } }
      }catch{}
    }
    if(valid.length===0){ await dl.cleanup(directory); throw new Error("File too large for Discord (max 8MB) and compression failed"); }
    const primaryInfo = info || {};
    primaryInfo._raw = files.length>1 ? files : undefined;
    const embed = buildEmbed(primaryInfo, source, interaction, { url: info?.webpage_url || url });


    if(valid.length>1){
      const Attach = interaction.client?.AttachmentBuilder || require("discord.js").AttachmentBuilder;
      const atts = valid.slice(0,10).map(f=> new Attach(f).setName(path.basename(f)));
      const doneEmbed = (new interaction.client.ebuilder).setColor("#57F287").setTitle("Download Complete").setDescription(`${valid.length} files downloaded`).setTimestamp();
      if(interaction.user) doneEmbed.setFooter({ text:`Requested by ${interaction.user.username}` });
      await interaction.editReply({ embeds:[doneEmbed], files:atts });
    } else {
      const Attach = interaction.client?.AttachmentBuilder || require("discord.js").AttachmentBuilder;
      const file=valid[0]; const st=await fs.stat(file);
      const att = new Attach(file).setName(path.basename(file));
      const doneEmbed = (new interaction.client.ebuilder).setColor("#57F287").setTitle("Download Complete")
        .setDescription(`**${primaryInfo.title||primaryInfo.description||"Media"}**\n• Author: ${primaryInfo.uploader||primaryInfo.channel||"Unknown"}\n• Duration: ${formatDuration(primaryInfo.duration||0)}\n• Size: ${(st.size/1024/1024).toFixed(1)}MB`)
        .setTimestamp();
      if(interaction.user) doneEmbed.setFooter({ text:`Requested by ${interaction.user.username}` });
      if(primaryInfo.thumbnail) doneEmbed.setThumbnail(primaryInfo.thumbnail);
      await interaction.editReply({ embeds:[doneEmbed], files:[att] });
    }
    for(const f of cFiles) await fs.unlink(f).catch(()=>{});
    return { files:valid, directory, info, source };
  } catch(e){
    try{ const errEmbed=(new interaction.client.ebuilder).setColor("#ED4245").setDescription(`Download failed: ${e.message}`); await interaction.editReply({ embeds:[errEmbed] }); }catch{}
    throw e;
  } finally { try{ await dl.cleanup(directory);}catch{} }
}


function getSupportedProviders(){ return PROVIDERS.map(p=> ({ id:p.id, name:p.name, domains:[...p.domains], pattern:p.pattern.source, description:p.description })); }
function getProvider(id){ return PROVIDER_MAP[id] || null; }
function isSupported(url){ return detectSource(url) !== "generic" || true;  }


function buildYtDlpArgsPreview(url, opts={}, outputDir="/tmp/preview"){
  const dl = _getDownloader();

  const args=[];
  if(typeof dl._appendCommonDownloadOpts==="function"){

    const fmt = opts.format || "bv*+ba/b";
    args.push("-f", fmt);
    args.push("-o", path.join(outputDir, opts.filenameFormat || opts.outputTemplate || "%(title).50s.%(ext)s"));
    args.push("--no-playlist");
    args.push("--merge-output-format", opts.mergeOutputFormat || "mp4");
    args.push("--js-runtimes","node","--remote-components","ejs:github");
    dl._appendCommonDownloadOpts(args, normalizeOpts(opts), outputDir, false, false);
    args.push(url);
  } else {
    args.push(url, JSON.stringify(opts));
  }
  return args;
}


module.exports = {

  PROVIDERS,
  PROVIDER_MAP,
  SUPPORTED_SOURCES,
  SUPPORTED_PROVIDERS,
  EXTRACTOR_COUNT,
  SUPPORTED_EXTRACTORS: EXTRACTOR_COUNT,
  getSupportedProviders,
  getProvider,


  detectSource,
  formatDuration,
  buildCaption,
  buildEmbed,
  getFileInfo,
  parseCliFlags,
  normalizeOpts,
  normalizeDownloadOpts: normalizeOpts,
  parseDownloadOpts: normalizeOpts,
  buildYtDlpArgsPreview,
  isSupported,


  download,
  getMetadata,
  search,


  listExtractors,
  extractorDescriptions,
  getExtractorDescriptions: extractorDescriptions,
  listFormats,
  listSubs,
  listThumbnails,
  getHelp,


  downloadAndSend,
  downloadAndSendWA,
  downloadAndSendTG,
  downloadAndSendDC,


  downloadMedia: downloadAndSendTG,
};


try {
  if (global.scraper) {
    global.scraper.unified = module.exports;
    global.scraper["unified-downloader"] = module.exports;
    global.scraper.unifiedDownloader = module.exports;
  }
} catch {}

try {
  const _orig = module.exports;
  Object.defineProperty(module.exports, "__esModule", { value: true });

  if (typeof global !== "undefined" && global.scraper) {
    global.scraper.unified = _orig;
  }
} catch {}

