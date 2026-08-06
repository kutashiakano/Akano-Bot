const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const fsPromises = require("fs").promises;
const path = require("path");

function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return h > 0 ? `${h}:${m.padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function detectSource(url) {
  if (/tiktok\.com|vt\.tiktok\.com/i.test(url)) return "tiktok";
  if (/instagram\.com/i.test(url)) return "instagram";
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/facebook\.com|fb\.watch/i.test(url)) return "facebook";
  if (/x\.com|twitter\.com/i.test(url)) return "twitter";
  if (/open\.spotify\.com|spotify\.link/i.test(url)) return "spotify";
  if (/pinterest\.com|pin\.it/i.test(url)) return "pinterest";
  return "generic";
}

function buildEmbed(info, source, interaction) {
  const title = info.title || info.description || "Media";
  const author = info.uploader || info.channel || info.creator || "Unknown";
  const desc = info.description || "";
  const duration = info.duration || 0;
  const views = info.view_count || 0;
  const thumbnail = info.thumbnail || "";

  const embed = new EmbedBuilder().setColor("#5865F2");

  if (source === "tiktok") {
    embed.setTitle(`TikTok ${info._type === "photo" ? "Slide" : "Video"}`);
    if (author !== "Unknown") embed.addFields({ name: "Author", value: author, inline: true });
    if (desc) {
      const shortDesc = desc.length > 300 ? desc.substring(0, 300) + "..." : desc;
      embed.addFields({ name: "Description", value: shortDesc });
    }
  } else if (source === "instagram") {
    const isCarousel = Array.isArray(info._raw) && info._raw.length > 1;
    embed.setTitle(`Instagram ${isCarousel ? "Carousel (" + info._raw.length + " items)" : "Post"}`);
    if (author !== "Unknown") embed.addFields({ name: "Author", value: author, inline: true });
    if (desc) {
      const shortDesc = desc.length > 300 ? desc.substring(0, 300) + "..." : desc;
      embed.addFields({ name: "Description", value: shortDesc });
    }
  } else if (source === "youtube") {
    embed.setTitle(`YouTube ${duration > 0 ? "Video" : "Short"}`);
    embed.setDescription(`**${title}**`);
    if (author !== "Unknown") embed.addFields({ name: "Author", value: author, inline: true });
    if (duration > 0) embed.addFields({ name: "Duration", value: `\`${formatDuration(duration)}\``, inline: true });
    if (views > 0) embed.addFields({ name: "Views", value: views.toLocaleString(), inline: true });
    if (desc) {
      const shortDesc = desc.length > 300 ? desc.substring(0, 300) + "..." : desc;
      embed.addFields({ name: "Description", value: shortDesc });
    }
  } else if (source === "facebook") {
    embed.setTitle("Facebook Video");
    if (title && title !== "Unknown") embed.setDescription(`**${title}**`);
    if (author !== "Unknown") embed.addFields({ name: "Author", value: author, inline: true });
    if (duration > 0) embed.addFields({ name: "Duration", value: `\`${formatDuration(duration)}\``, inline: true });
  } else if (source === "twitter") {
    embed.setTitle(`Twitter/X ${info._type === "photo" ? "Media" : "Video"}`);
    if (author !== "Unknown") embed.addFields({ name: "Author", value: author, inline: true });
    if (desc) {
      const shortDesc = desc.length > 300 ? desc.substring(0, 300) + "..." : desc;
      embed.addFields({ name: "Description", value: shortDesc });
    }
    if (duration > 0) embed.addFields({ name: "Duration", value: `\`${formatDuration(duration)}\``, inline: true });
  } else if (source === "spotify") {
    embed.setTitle("Spotify Track");
    embed.setDescription(`**${title}**`);
    if (author !== "Unknown") embed.addFields({ name: "Artist", value: author, inline: true });
    if (duration > 0) embed.addFields({ name: "Duration", value: `\`${formatDuration(duration)}\``, inline: true });
  } else if (source === "pinterest") {
    embed.setTitle("Pinterest Pin");
    if (author !== "Unknown") embed.addFields({ name: "Author", value: author, inline: true });
    if (desc) {
      const shortDesc = desc.length > 300 ? desc.substring(0, 300) + "..." : desc;
      embed.addFields({ name: "Description", value: shortDesc });
    }
  } else {
    embed.setTitle("Media Download");
    if (title && title !== "Media") embed.setDescription(`**${title}**`);
    if (author !== "Unknown") embed.addFields({ name: "Author", value: author, inline: true });
    if (duration > 0) embed.addFields({ name: "Duration", value: `\`${formatDuration(duration)}\``, inline: true });
  }

  if (thumbnail) embed.setThumbnail(thumbnail);
  embed.setFooter({ text: `Requested by ${interaction.user.username}` });
  embed.setTimestamp();

  return embed;
}

module.exports = {
  name: "dl",
  description: "Download media from YouTube, TikTok, Instagram, Twitter/X, Facebook, Spotify, Pinterest",
  options: [
    {
      name: "url",
      type: 3,
      description: "URL to download",
      required: true,
    },
    {
      name: "audio",
      type: 5,
      description: "Download as audio only (default: false)",
      required: false,
    },
  ],
  async execute(interaction) {
    try {
      await interaction.deferReply();
    } catch (e) {
      return;
    }

    const url = interaction.options.getString("url");
    const audioOnly = interaction.options.getBoolean("audio") || false;

    const supportedDomains = [
      "youtube.com", "youtu.be", "tiktok.com", "vt.tiktok.com",
      "instagram.com", "x.com", "twitter.com", "facebook.com",
      "fb.watch", "pinterest.com", "pin.it", "open.spotify.com",
      "spotify.link",
    ];
    const isSupported = supportedDomains.some((d) => url.includes(d));
    if (!isSupported) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ED4245")
            .setDescription(
              "URL not supported.\n\nSupported:\nYouTube, TikTok, Instagram, Twitter/X, Facebook, Pinterest, Spotify"
            ),
        ],
      });
    }

    const source = detectSource(url);
    const isSpotify = source === "spotify";
    const effectiveAudio = isSpotify ? true : audioOnly;

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
      await interaction.editReply({ embeds: [embed] });

      const downloadOptions = {};
      const cookiesPath = path.join(__dirname, "../../../cookies.txt");
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
          if (stat.size <= maxSize) validFiles.push(file);
        } catch {}
      }

      if (validFiles.length === 0) {
        await downloader.cleanup(result.directory);
        throw new Error("File too large for Discord (max 8MB).");
      }

      if (isGallery && validFiles.length > 1) {
        const files = validFiles.slice(0, 10).map((f) => {
          const attachment = new AttachmentBuilder(f);
          attachment.setName(path.basename(f));
          return attachment;
        });

        const finalEmbed = new EmbedBuilder()
          .setColor("#57F287")
          .setTitle("Download Complete")
          .setDescription(`${validFiles.length} files downloaded`)
          .setFooter({ text: `Requested by ${interaction.user.username}` })
          .setTimestamp();

        await interaction.editReply({ embeds: [finalEmbed], files });
      } else {
        const file = validFiles[0];
        const stat = await fsPromises.stat(file);
        const attachment = new AttachmentBuilder(file);
        attachment.setName(path.basename(file));

        const finalEmbed = new EmbedBuilder()
          .setColor("#57F287")
          .setTitle("Download Complete")
          .setDescription(
            `**${info.title || info.description || "Media"}**\n` +
            `\u2022 Author: ${info.uploader || info.channel || "Unknown"}\n` +
            `\u2022 Duration: ${formatDuration(info.duration || 0)}\n` +
            `\u2022 Size: ${(stat.size / 1024 / 1024).toFixed(1)}MB`
          )
          .setFooter({ text: `Requested by ${interaction.user.username}` })
          .setTimestamp();

        if (info.thumbnail) finalEmbed.setThumbnail(info.thumbnail);
        await interaction.editReply({ embeds: [finalEmbed], files: [attachment] });
      }

      await downloader.cleanup(result.directory);
    } catch (error) {
      console.error("[Downloader Error]", error.message);
      try {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ED4245")
              .setDescription(`Download failed: ${error.message}`),
          ],
        });
      } catch (e) {}
    }
  },
};
