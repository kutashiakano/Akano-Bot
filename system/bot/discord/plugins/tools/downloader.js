const {execFile: execFile} = require("child_process");
const os = require("os");

const fsPromises = require("fs").promises;

const path = require("path");

function compressAudio(file, maxSize) {
  return new Promise(resolve => {
    const ext = path.extname(file).toLowerCase();
    if (![ ".mp3", ".m4a", ".opus", ".wav", ".ogg", ".aac" ].includes(ext)) return resolve(null);
    const tmpOut = path.join(os.tmpdir(), `akano_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp3`);
    execFile("ffmpeg", [ "-y", "-i", file, "-b:a", "64k", "-ac", "1", tmpOut ], {
      timeout: 12e4
    }, async err => {
      if (err) return resolve(null);
      try {
        const stat = await fsPromises.stat(tmpOut);
        if (stat.size > 0 && stat.size <= maxSize) return resolve(tmpOut);
      } catch {}
      await fsPromises.unlink(tmpOut).catch(() => {});
      resolve(null);
    });
  });
}

async function cleanupFiles(files) {
  for (const f of files) await fsPromises.unlink(f).catch(() => {});
}

function formatDuration(seconds) {
  if (_udl && typeof _udl.formatDuration === "function") return _udl.formatDuration(seconds);
  if (!seconds || seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return h > 0 ? `${h}:${m.padStart(2, "0")}:${s}` : `${m}:${s}`;
}

let _udl = null;
try { _udl = require("../../../../scrapers/src/unified-downloader"); } catch {}
function detectSource(url) {
  if (_udl && typeof _udl.detectSource === "function") return _udl.detectSource(url);
  if (/tiktok\.com|vt\.tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/facebook\.com|fb\.watch/i.test(url)) return "facebook";
  if (/x\.com|twitter\.com/i.test(url)) return "twitter";
  if (/open\.spotify\.com|spotify\.link/i.test(url)) return "spotify";
  if (/pinterest\.com|pin\.it/i.test(url)) return "pinterest";
  if (/reddit\.com|redd\.it/i.test(url)) return "reddit";
  if (/twitch\.tv/i.test(url)) return "twitch";
  if (/vimeo\.com/i.test(url)) return "vimeo";
  if (/soundcloud\.com/i.test(url)) return "soundcloud";
  return "generic";
}

function buildEmbed(info, source, interaction) {
  if (_udl && typeof _udl.buildEmbed === "function") {
    try { return _udl.buildEmbed(info, source, interaction); } catch {}
  }
  const title = info.title || info.description || "Media";
  const author = info.uploader || info.channel || info.creator || "Unknown";
  const desc = info.description || "";
  const duration = info.duration || 0;
  const views = info.view_count || 0;
  const thumbnail = info.thumbnail || "";
  const embed = (new interaction.client.ebuilder).setColor("#5865F2");
  if (source === "tiktok") {
    embed.setTitle(`TikTok ${info._type === "photo" ? "Slide" : "Video"}`);
    if (author !== "Unknown") embed.addFields({
      name: "Author",
      value: author,
      inline: true
    });
    if (desc) {
      const shortDesc = desc.length > 300 ? desc.substring(0, 300) + "..." : desc;
      embed.addFields({
        name: "Description",
        value: shortDesc
      });
    }
  } else if (source === "instagram") {
    const isCarousel = Array.isArray(info._raw) && info._raw.length > 1;
    embed.setTitle(`Instagram ${isCarousel ? "Carousel (" + info._raw.length + " items)" : "Post"}`);
    if (author !== "Unknown") embed.addFields({
      name: "Author",
      value: author,
      inline: true
    });
    if (desc) {
      const shortDesc = desc.length > 300 ? desc.substring(0, 300) + "..." : desc;
      embed.addFields({
        name: "Description",
        value: shortDesc
      });
    }
  } else if (source === "youtube") {
    embed.setTitle(`YouTube ${duration > 0 ? "Video" : "Short"}`);
    embed.setDescription(`**${title}**`);
    if (author !== "Unknown") embed.addFields({
      name: "Author",
      value: author,
      inline: true
    });
    if (duration > 0) embed.addFields({
      name: "Duration",
      value: `\`${formatDuration(duration)}\``,
      inline: true
    });
    if (views > 0) embed.addFields({
      name: "Views",
      value: views.toLocaleString(),
      inline: true
    });
    if (desc) {
      const shortDesc = desc.length > 300 ? desc.substring(0, 300) + "..." : desc;
      embed.addFields({
        name: "Description",
        value: shortDesc
      });
    }
  } else if (source === "facebook") {
    embed.setTitle("Facebook Video");
    if (title && title !== "Unknown") embed.setDescription(`**${title}**`);
    if (author !== "Unknown") embed.addFields({
      name: "Author",
      value: author,
      inline: true
    });
    if (duration > 0) embed.addFields({
      name: "Duration",
      value: `\`${formatDuration(duration)}\``,
      inline: true
    });
  } else if (source === "twitter") {
    embed.setTitle(`Twitter/X ${info._type === "photo" ? "Media" : "Video"}`);
    if (author !== "Unknown") embed.addFields({
      name: "Author",
      value: author,
      inline: true
    });
    if (desc) {
      const shortDesc = desc.length > 300 ? desc.substring(0, 300) + "..." : desc;
      embed.addFields({
        name: "Description",
        value: shortDesc
      });
    }
    if (duration > 0) embed.addFields({
      name: "Duration",
      value: `\`${formatDuration(duration)}\``,
      inline: true
    });
  } else if (source === "spotify") {
    embed.setTitle("Spotify Track");
    embed.setDescription(`**${title}**`);
    if (author !== "Unknown") embed.addFields({
      name: "Artist",
      value: author,
      inline: true
    });
    if (duration > 0) embed.addFields({
      name: "Duration",
      value: `\`${formatDuration(duration)}\``,
      inline: true
    });
  } else if (source === "pinterest") {
    embed.setTitle("Pinterest Pin");
    if (author !== "Unknown") embed.addFields({
      name: "Author",
      value: author,
      inline: true
    });
    if (desc) {
      const shortDesc = desc.length > 300 ? desc.substring(0, 300) + "..." : desc;
      embed.addFields({
        name: "Description",
        value: shortDesc
      });
    }
  } else {
    embed.setTitle("Media Download");
    if (title && title !== "Media") embed.setDescription(`**${title}**`);
    if (author !== "Unknown") embed.addFields({
      name: "Author",
      value: author,
      inline: true
    });
    if (duration > 0) embed.addFields({
      name: "Duration",
      value: `\`${formatDuration(duration)}\``,
      inline: true
    });
  }
  if (thumbnail) embed.setThumbnail(thumbnail);
  embed.setFooter({
    text: `Requested by ${interaction.user.username}`
  });
  embed.setTimestamp();
  return embed;
}

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "dl" ],
  category: "tools",
  description: "Download media via yt-dlp (YouTube, TikTok, IG, X, FB, Spotify, Pinterest, 1752 sites)",
  options: [ {
    name: "url",
    type: 3,
    description: "URL to download",
    required: true
  }, {
    name: "audio",
    type: 5,
    description: "Download as audio only (default: false)",
    required: false
  }, {
    name: "format",
    type: 3,
    description: "yt-dlp --format (e.g. bv*+ba/b, bestvideo+bestaudio)",
    required: false
  }, {
    name: "audio_format",
    type: 3,
    description: "yt-dlp --audio-format (mp3, m4a, opus, flac, wav, aac...)",
    required: false
  }, {
    name: "audio_quality",
    type: 3,
    description: "yt-dlp --audio-quality (0-10 or 128K, 320K)",
    required: false
  }, {
    name: "embed_thumbnail",
    type: 5,
    description: "yt-dlp --embed-thumbnail",
    required: false
  }, {
    name: "embed_metadata",
    type: 5,
    description: "yt-dlp --embed-metadata",
    required: false
  }, {
    name: "write_subs",
    type: 5,
    description: "yt-dlp --write-subs",
    required: false
  }, {
    name: "write_auto_subs",
    type: 5,
    description: "yt-dlp --write-auto-subs",
    required: false
  }, {
    name: "sub_langs",
    type: 3,
    description: "yt-dlp --sub-langs (e.g. en,ja or all)",
    required: false
  }, {
    name: "extra_options",
    type: 3,
    description: "Extra yt-dlp flags (e.g. --format-sort, --download-sections, extractor-args)",
    required: false
  } ],
  run: async ctx => {
    const interaction = ctx.interaction;
    try {
      await interaction.deferReply();
    } catch (e) {
      return;
    }
    const url = interaction.options.getString("url");
    const audioOnly = interaction.options.getBoolean("audio") || false;

    let formatOpt = null, audioFormatOpt = null, audioQualityOpt = null, embedThumbOpt = null, embedMetaOpt = null, writeSubsOpt = null, writeAutoSubsOpt = null, subLangsOpt = null, extraOptsStr = null;
    try { formatOpt = interaction.options.getString("format"); } catch {}
    try { audioFormatOpt = interaction.options.getString("audio_format"); } catch {}
    try { audioQualityOpt = interaction.options.getString("audio_quality"); } catch {}
    try { embedThumbOpt = interaction.options.getBoolean("embed_thumbnail"); } catch {}
    try { embedMetaOpt = interaction.options.getBoolean("embed_metadata"); } catch {}
    try { writeSubsOpt = interaction.options.getBoolean("write_subs"); } catch {}
    try { writeAutoSubsOpt = interaction.options.getBoolean("write_auto_subs"); } catch {}
    try { subLangsOpt = interaction.options.getString("sub_langs"); } catch {}
    try { extraOptsStr = interaction.options.getString("extra_options"); } catch {}
    const supportedDomains = [ "youtube.com", "youtu.be", "tiktok.com", "vt.tiktok.com", "instagram.com", "x.com", "twitter.com", "facebook.com", "fb.watch", "pinterest.com", "pin.it", "open.spotify.com", "spotify.link", "reddit.com", "twitch.tv", "vimeo.com", "soundcloud.com", "dailymotion.com", "kick.com", "streamable.com", "rumble.com", "odysee.com", "bilibili.com", "vk.com", "ok.ru", "rutube.ru" ];

    let isSupported = true;
    if (_udl && typeof _udl.isSupported === "function") isSupported = true;
    else isSupported = supportedDomains.some(d => url.includes(d)) || /^https?:\/\//i.test(url);
    if (!isSupported) {
      return interaction.editReply({
        embeds: [ (new interaction.client.ebuilder).setColor("#ED4245").setDescription("URL not supported.\n\nSupported via yt-dlp 1752 extractors:\nYouTube, TikTok, Instagram, Twitter/X, Facebook, Pinterest, Spotify, Reddit, Twitch, Vimeo, SoundCloud, etc. (generic fallback for any site)") ]
      });
    }
    const source = detectSource(url);
    const isSpotify = source === "spotify";
    const effectiveAudio = isSpotify ? true : audioOnly;

    const hasAdvanced = !!(formatOpt || audioFormatOpt || audioQualityOpt || embedThumbOpt || embedMetaOpt || writeSubsOpt || writeAutoSubsOpt || subLangsOpt || extraOptsStr);
    if (_udl && hasAdvanced && typeof _udl.downloadAndSendDC === "function") {
      const advOpts = {};
      if (formatOpt) advOpts.format = formatOpt;
      if (audioFormatOpt) advOpts.audioFormat = audioFormatOpt;
      if (audioQualityOpt) advOpts.audioQuality = audioQualityOpt;
      if (embedThumbOpt) advOpts.embedThumbnail = true;
      if (embedMetaOpt) advOpts.embedMetadata = true;
      if (writeSubsOpt) advOpts.writeSubs = true;
      if (writeAutoSubsOpt) advOpts.writeAutoSubs = true;
      if (subLangsOpt) advOpts.subLangs = subLangsOpt;
      if (effectiveAudio) { advOpts.audioOnly = true; if (!advOpts.audioFormat) advOpts.audioFormat = "mp3"; }
      if (extraOptsStr && _udl.parseCliFlags) {
        const extra = _udl.parseCliFlags(extraOptsStr);
        Object.assign(advOpts, extra);
        if (effectiveAudio && !advOpts.audioOnly) advOpts.audioOnly = true;
      }
      return _udl.downloadAndSendDC(interaction, url, advOpts);
    }
    const cFiles = [];
    try {
      const downloader = global.scraper?.ytdpl;
      if (!downloader) throw new Error("Downloader not available.");
      const metadata = await downloader.getMetadata(url);
      if (!metadata) throw new Error("Failed to get metadata.");
      let info = Array.isArray(metadata) ? metadata[0] : metadata;
      if (!info) throw new Error("Invalid metadata received.");
      const isGallery = Array.isArray(metadata) && metadata.length > 1;
      info._raw = metadata;
      const embed = buildEmbed(info, source, interaction);
      await interaction.editReply({
        embeds: [ embed ]
      });
      const downloadOptions = {};
      const cookiesPath = path.join(__dirname, "../../../../../cookies.txt");
      try {
        await fsPromises.access(cookiesPath);
        downloadOptions.cookies = cookiesPath;
      } catch {}
      if (effectiveAudio) {
        downloadOptions.audioOnly = true;
        downloadOptions.audioFormat = "mp3";
      }
      const result = await downloader.download(url, downloadOptions);
      if (!result || !result.files || result.files.length === 0) {
        throw new Error("Download failed - no files returned.");
      }
      const maxSize = 8 * 1024 * 1024;
      const validFiles = [];
      for (const file of result.files) {
        try {
          const stat = await fsPromises.stat(file);
          if (stat.size <= maxSize) {
            validFiles.push(file);
          } else if (effectiveAudio) {
            const compressed = await compressAudio(file, maxSize);
            if (compressed) {
              validFiles.push(compressed);
              cFiles.push(compressed);
            }
          }
        } catch {}
      }
      if (validFiles.length === 0) {
        await downloader.cleanup(result.directory);
        throw new Error("File too large for Discord (max 8MB) and audio compression failed.");
      }
      if (isGallery && validFiles.length > 1) {
        const files = validFiles.slice(0, 10).map(f => {
          const attachment = new interaction.client.AttachmentBuilder(f);
          attachment.setName(path.basename(f));
          return attachment;
        });
        const finalEmbed = (new interaction.client.ebuilder).setColor("#57F287").setTitle("Download Complete").setDescription(`${validFiles.length} files downloaded`).setFooter({
          text: `Requested by ${interaction.user.username}`
        }).setTimestamp();
        await interaction.editReply({
          embeds: [ finalEmbed ],
          files: files
        });
      } else {
        const file = validFiles[0];
        const stat = await fsPromises.stat(file);
        const attachment = new interaction.client.AttachmentBuilder(file);
        attachment.setName(path.basename(file));
        const finalEmbed = (new interaction.client.ebuilder).setColor("#57F287").setTitle("Download Complete").setDescription(`**${info.title || info.description || "Media"}**\n` + `• Author: ${info.uploader || info.channel || "Unknown"}\n` + `• Duration: ${formatDuration(info.duration || 0)}\n` + `• Size: ${(stat.size / 1024 / 1024).toFixed(1)}MB`).setFooter({
          text: `Requested by ${interaction.user.username}`
        }).setTimestamp();
        if (info.thumbnail) finalEmbed.setThumbnail(info.thumbnail);
        await interaction.editReply({
          embeds: [ finalEmbed ],
          files: [ attachment ]
        });
      }
      await cleanupFiles(cFiles);
      await downloader.cleanup(result.directory);
    } catch (error) {
      console.error("[Downloader Error]", error.message);
      await cleanupFiles(cFiles).catch(() => {});
      try {
        await interaction.editReply({
          embeds: [ (new interaction.client.ebuilder).setColor("#ED4245").setDescription(`Download failed: ${error.message}`) ]
        });
      } catch (e) {}
    }
  }
});