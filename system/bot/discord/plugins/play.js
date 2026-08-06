const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  NoSubscriberBehavior,
  StreamType
} = require("@discordjs/voice");
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");
const fs = require("fs");
const fsPromises = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const cheerio = require("cheerio");

const queues = new Map();
const lyricsCache = new Map();
const PLAYER_STATE_FILE = path.join(__dirname, "../playerState.json");

const AUDIO_FILTERS = {
  none: { label: "None", emoji: "✖️", args: [] },
  bassboost: { label: "Bass Boost", emoji: "🔊", args: ["-af", "bass=g=10"] },
  nightcore: { label: "Nightcore", emoji: "⏫", args: ["-af", "asetrate=48000*1.25,aresample=48000"] },
  vaporwave: { label: "Vaporwave", emoji: "🌴", args: ["-af", "asetrate=48000*0.8,aresample=48000"] },
  "8d": { label: "8D Audio", emoji: "🌀", args: ["-af", "apulsator=hz=0.09"] }
};

const AUTOPLAY_GENRES = {
  pop: { label: "Pop", emoji: "🎵", queries: ["pop hits 2024", "top pop songs", "pop music official", "viral pop hits"] },
  rock: { label: "Rock", emoji: "🎸", queries: ["rock music playlist", "best rock songs", "rock classics", "alternative rock hits"] },
  hiphop: { label: "Hip-Hop", emoji: "🎤", queries: ["hip hop mix 2024", "rap hits 2024", "trap music playlist", "best rap songs"] },
  electronic: { label: "Electronic", emoji: "🎛️", queries: ["edm music mix", "electronic dance music", "house music official", "techno music"] },
  jazz: { label: "Jazz", emoji: "🎷", queries: ["jazz cafe music", "smooth jazz playlist", "jazz instrumental", "lofi jazz"] },
  classical: { label: "Classical", emoji: "🎻", queries: ["classical music focus", "piano classical music", "orchestra classical", "classical relaxation"] },
  metal: { label: "Metal", emoji: "🤘", queries: ["metal music playlist", "heavy metal hits", "metalcore playlist", "death metal music"] },
  country: { label: "Country", emoji: "🤠", queries: ["country music hits", "country playlist 2024", "country songs official", "acoustic country"] },
  rnb: { label: "R&B", emoji: "💜", queries: ["r&b soul chill mix", "neo soul playlist", "r&b hits 2024", "r&b slow jams"] },
  indie: { label: "Indie", emoji: "🌙", queries: ["indie pop playlist", "alternative indie mix", "indie music 2024", "indie folk music"] },
  latin: { label: "Latin", emoji: "💃", queries: ["latin music hits", "reggaeton playlist", "latin pop songs", "spanish music hits"] },
  kpop: { label: "K-Pop", emoji: "🇰🇷", queries: ["kpop playlist 2024", "best kpop hits", "korean music official", "kpop dance music"] },
  anime: { label: "Anime", emoji: "⛩️", queries: ["anime opening official", "anime songs official", "best anime op", "anime music playlist"] },
  lofi: { label: "Lo-Fi", emoji: "☕", queries: ["lofi hip hop chill", "lofi beats study music", "chill lofi music", "lofi relaxing beats"] },
  blues: { label: "Blues", emoji: "🎶", queries: ["blues music playlist", "blues classics", "electric blues music", "blues guitar music"] },
  reggae: { label: "Reggae", emoji: "🌴", queries: ["reggae music playlist", "reggae hits", "bob marley style music", "reggae chill music"] },
  disco: { label: "Disco", emoji: "🪩", queries: ["disco music hits", "disco classics", "funk disco music", "disco party music"] },
  punk: { label: "Punk", emoji: "⚡", queries: ["punk rock music", "punk playlist", "punk hits", "punk classics"] },
  ambient: { label: "Ambient", emoji: "🌊", queries: ["ambient music relaxing", "ambient soundscape", "ambient study music", "ambient meditation"] },
  random: { label: "Random", emoji: "🎲", queries: ["lofi hip hop chill", "top hits 2024", "edm music mix", "acoustic guitar covers", "kpop playlist 2024", "jazz cafe music", "rock music playlist", "chill vibes music"] }
};

const BLOCKED_KEYWORDS = [
  "tutorial", "lesson", "course", "how-to", "guide", "podcast", "interview",
  "talk", "speech", "lecture", "review", "unboxing", "reaction", "gameplay",
  "full movie", "full album", "documentary", "asmr", "audiobook", "story",
  "meditation", "compilation", "mix", "dj set", "long version"
];

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function parseSeekTime(input) {
  const parts = input.split(":").map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  const n = Number(input);
  return isNaN(n) ? null : n;
}

function createVolumeBar(percent) {
  const barLen = 15;
  const filled = Math.round((percent / 100) * barLen);
  return "▓".repeat(filled) + "░".repeat(barLen - filled) + ` ${percent}%`;
}

function savePlayerState(guildId, queue) {
  try {
    let db = { players: {} };
    if (fs.existsSync(PLAYER_STATE_FILE)) {
      db = JSON.parse(fs.readFileSync(PLAYER_STATE_FILE, "utf8"));
    }
    db.players[guildId] = {
      songs: queue.songs.map(s => ({ title: s.title, url: s.url, duration: s.duration, source: s.source, requester: s.requester, thumbnail: s.thumbnail })),
      loop: queue.loop,
      shuffle: queue.shuffle,
      autoplay: queue.autoplay,
      autoplayGenre: queue.autoplayGenre,
      volume: queue.volume,
      filter: queue.currentFilter || "none",
      updatedAt: Date.now()
    };
    fs.writeFileSync(PLAYER_STATE_FILE, JSON.stringify(db, null, 2));
  } catch (e) {}
}

function loadPlayerState(guildId) {
  try {
    if (!fs.existsSync(PLAYER_STATE_FILE)) return null;
    const db = JSON.parse(fs.readFileSync(PLAYER_STATE_FILE, "utf8"));
    return db.players?.[guildId] || null;
  } catch (e) { return null; }
}

function clearPlayerState(guildId) {
  try {
    if (!fs.existsSync(PLAYER_STATE_FILE)) return;
    const db = JSON.parse(fs.readFileSync(PLAYER_STATE_FILE, "utf8"));
    delete db.players?.[guildId];
    fs.writeFileSync(PLAYER_STATE_FILE, JSON.stringify(db, null, 2));
  } catch (e) {}
}

function cleanLyricsText(text) {
  if (!text) return null;
  return text
    .replace(/\d+\s+Contributors.*?Lyrics(<[^>]+>)*\s*/is, "")
    .replace(/<[^>]*>/g, "")
    .replace(/^[^\[]+?\.{3}\s*Read More\s*/im, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim() || null;
}

async function fetchLyrics(title) {
  const cacheKey = (title || "").toLowerCase().replace(/[()[\]]/g, "").replace(/official.*$/i, "").trim();
  if (lyricsCache.has(cacheKey)) return lyricsCache.get(cacheKey);

  try {
    const fetch = require("node-fetch");
    const query = encodeURIComponent(cacheKey);
    const res = await fetch(`https://lrclib.net/api/search?q=${query}`, {
      headers: { "User-Agent": "AkanoBot/1.0" }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.length > 0) {
        const match = data.find(l => l.syncedLyrics) || data[0];
        const result = { plain: match.plainLyrics || null, synced: match.syncedLyrics || null, source: "LRCLIB" };
        lyricsCache.set(cacheKey, result);
        setTimeout(() => lyricsCache.delete(cacheKey), 3600000);
        return result;
      }
    }
  } catch (e) {}
  lyricsCache.set(cacheKey, null);
  return null;
}

async function fetchGeniusLyrics(title) {
  const cacheKey = "genius_" + (title || "").toLowerCase().trim();
  if (lyricsCache.has(cacheKey)) return lyricsCache.get(cacheKey);

  try {
    const fetch = require("node-fetch");
    const cleanTitle = title.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").replace(/official.*$/i, "").trim();
    const searchRes = await fetch(`https://genius.com/api/search?q=${encodeURIComponent(cleanTitle)}`, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const hit = searchData?.response?.hits?.[0];
    if (!hit) return null;

    const songUrl = hit.result?.url;
    if (!songUrl) return null;

    const pageRes = await fetch(songUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!pageRes.ok) return null;
    const html = await pageRes.text();
    const $ = cheerio.load(html);
    const lyricsDiv = $("[data-lyrics-container='true']");
    if (!lyricsDiv.length) return null;

    let lyrics = "";
    lyricsDiv.each((_, el) => { lyrics += $(el).html() + "\n"; });
    lyrics = lyrics.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "").trim();
    lyrics = cleanLyricsText(lyrics);

    if (lyrics) {
      const result = { plain: lyrics, synced: null, source: "Genius" };
      lyricsCache.set(cacheKey, result);
      setTimeout(() => lyricsCache.delete(cacheKey), 3600000);
      return result;
    }
  } catch (e) {}
  return null;
}

async function getLyricsWithFallback(title) {
  const genius = await fetchGeniusLyrics(title);
  if (genius?.plain) return genius;
  return await fetchLyrics(title);
}

function buildProgressBar(current, total, length = 14) {
  if (!total || total === 0) return "—".repeat(length);
  const progress = Math.min(Math.floor((current / total) * length), length - 1);
  return "═".repeat(progress) + "●" + "═".repeat(length - progress - 1);
}

function isBlockedContent(title) {
  if (!title) return false;
  const lower = title.toLowerCase();
  return BLOCKED_KEYWORDS.some(kw => lower.includes(kw));
}

function isValidAutoplayTrack(track) {
  if (!track || !track.title || !track.duration) return false;
  if (track.duration < 30 || track.duration > 600) return false;
  if (isBlockedContent(track.title)) return false;
  if (track.title.match(/[\u{1F600}-\u{1F64F}]/u)?.length > 3) return false;
  return true;
}

function buildControlButtons(queue) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("music_prev")
      .setLabel("Prev")
      .setEmoji("⏮️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!queue.previousTracks || queue.previousTracks.length === 0),
    new ButtonBuilder()
      .setCustomId("music_pause")
      .setLabel(queue.paused ? "Resume" : "Pause")
      .setEmoji(queue.paused ? "▶️" : "⏸️")
      .setStyle(queue.paused ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_skip")
      .setLabel("Skip")
      .setEmoji("⏭️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_stop")
      .setLabel("Stop")
      .setEmoji("⏹️")
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId("music_queue")
      .setLabel("Queue")
      .setEmoji("📋")
      .setStyle(ButtonStyle.Primary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("music_shuffle")
      .setLabel("Shuffle")
      .setEmoji("🔀")
      .setStyle(queue.shuffle ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_volume")
      .setLabel("Volume")
      .setEmoji("🔊")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_seek")
      .setLabel("Seek")
      .setEmoji("⏩")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_loop")
      .setLabel(queue.loop === "track" ? "Loop Track" : queue.loop === "queue" ? "Loop Queue" : "Loop Off")
      .setEmoji(queue.loop === "track" ? "🔂" : queue.loop === "queue" ? "🔁" : "➡️")
      .setStyle(queue.loop !== "off" ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_filter")
      .setLabel("Filter")
      .setEmoji("🎛️")
      .setStyle((queue.currentFilter && queue.currentFilter !== "none") ? ButtonStyle.Success : ButtonStyle.Secondary)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("music_autoplay")
      .setLabel(queue.autoplay ? "Autoplay On" : "Autoplay Off")
      .setEmoji("🎲")
      .setStyle(queue.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("music_lyrics")
      .setLabel("Lyrics")
      .setEmoji("🎤")
      .setStyle(ButtonStyle.Secondary)
  );

  return [row1, row2, row3];
}

function buildGenreButtons() {
  const rows = [];
  const genreKeys = Object.keys(AUTOPLAY_GENRES);
  for (let i = 0; i < genreKeys.length; i += 5) {
    const row = new ActionRowBuilder();
    for (let j = i; j < Math.min(i + 5, genreKeys.length); j++) {
      const g = AUTOPLAY_GENRES[genreKeys[j]];
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`genre_${genreKeys[j]}`)
          .setLabel(g.label)
          .setEmoji(g.emoji)
          .setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(row);
  }
  return rows;
}

async function cleanupQueue(guildId) {
  const queue = queues.get(guildId);
  if (!queue) return;
  queues.delete(guildId);
  clearPlayerState(guildId);
  if (queue.checkInterval) clearInterval(queue.checkInterval);
  if (queue.idleTimer) clearTimeout(queue.idleTimer);
  if (queue.recoveryInterval) clearInterval(queue.recoveryInterval);
  if (queue.collector) try { queue.collector.stop(); } catch (e) {}
  if (queue.genreCollector) try { queue.genreCollector.stop(); } catch (e) {}
  try { queue.player.stop(true); } catch (e) {}
  try { queue.connection.destroy(); } catch (e) {}
  if (queue.currentDir) {
    try { await global.scraper.ytdpl.cleanup(queue.currentDir); } catch (e) {}
  }
  if (queue.nextDir) {
    try { await global.scraper.ytdpl.cleanup(queue.nextDir); } catch (e) {}
  }
  for (const dir of queue.downloadedDirs || []) {
    try { await global.scraper.ytdpl.cleanup(dir); } catch (e) {}
  }
}

function pickAutoplayQuery(genre) {
  if (genre && AUTOPLAY_GENRES[genre]) {
    const queries = AUTOPLAY_GENRES[genre].queries;
    return "ytsearch15:" + queries[Math.floor(Math.random() * queries.length)];
  }
  const genreKeys = Object.keys(AUTOPLAY_GENRES);
  const randomGenre = genreKeys[Math.floor(Math.random() * genreKeys.length)];
  const queries = AUTOPLAY_GENRES[randomGenre].queries;
  return "ytsearch15:" + queries[Math.floor(Math.random() * queries.length)];
}

async function fetchSmartRecommendation(queue) {
  try {
    const downloader = global.scraper?.ytdpl;
    if (!downloader) return null;

    const searchQuery = pickAutoplayQuery(queue.autoplayGenre);
    const searchResult = await downloader.getMetadata(searchQuery);
    const results = Array.isArray(searchResult) ? searchResult : [searchResult];

    const historySet = new Set(queue.history);
    const currentUrl = queue.currentSong?.url;

    const safe = results.filter((song) => {
      if (!song || !song.title || !song.duration) return false;
      const url = song.webpage_url || song.url || song.original_url;
      if (historySet.has(url) || url === currentUrl) return false;
      if (!isValidAutoplayTrack(song)) return false;
      return true;
    });

    if (safe.length > 0) {
      return safe[Math.floor(Math.random() * safe.length)];
    }

    return results.find((s) => s && s.duration && s.duration < 600 && s.duration > 30) || null;
  } catch (e) {
    console.error("[Play] Recommendation error:", e.message);
    return null;
  }
}

async function enqueueAutoplay(queue) {
  if (queue.autoplayFetching) return;
  queue.autoplayFetching = true;

  try {
    let attempts = 0;
    while (queue.songs.length === 0 && attempts < 3) {
      attempts++;
      const info = await fetchSmartRecommendation(queue);
      if (info) {
        queue.songs.push({
          title: info.title || "Unknown",
          url: info.webpage_url || info.url || info.original_url,
          thumbnail: info.thumbnail || "",
          duration: info.duration || 0,
          uploader: info.uploader || info.channel || "Unknown",
          requester: "Autoplay",
          source: "Autoplay"
        });
      }
    }
  } catch (e) {
    console.error("[Play] Autoplay enqueue error:", e.message);
  } finally {
    queue.autoplayFetching = false;
  }
}

async function preDownloadNext(guildId) {
  const queue = queues.get(guildId);
  if (!queue || queue.isDownloadingNext || queue.nextFilePath) return;

  if (queue.songs.length === 0) {
    await enqueueAutoplay(queue);
  }

  if (queue.songs.length === 0) return;

  queue.isDownloadingNext = true;
  try {
    const downloader = global.scraper?.ytdpl;
    if (!downloader) return;
    const nextSong = queue.songs[0];
    const result = await downloader.download(nextSong.url, {
      audioOnly: true,
      audioFormat: "opus",
      format: "bestaudio/best"
    });
    if (result && result.files && result.files.length > 0) {
      queue.nextFilePath = result.files[0];
      queue.nextDir = result.directory;
      queue.downloadedDirs.push(result.directory);
    }
  } catch (e) {
    console.error("[Play] Pre-download error:", e.message);
  } finally {
    queue.isDownloadingNext = false;
  }
}

async function fetchLyrics(title) {
  try {
    const fetch = require("node-fetch");
    const query = encodeURIComponent(title.replace(/[()[\]]/g, "").replace(/official.*$/i, "").trim());
    const res = await fetch(`https://lrclib.net/api/search?q=${query}`, {
      headers: { "User-Agent": "AkanoBot/1.0" }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.length > 0) {
      const match = data.find(l => l.syncedLyrics) || data[0];
      return {
        plain: match.plainLyrics || null,
        synced: match.syncedLyrics || null
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

function startInactivityCheck(queue, guildId) {
  if (queue.idleTimer) clearTimeout(queue.idleTimer);
  queue.idleTimer = setTimeout(async () => {
    const q = queues.get(guildId);
    if (!q) return;
    const channel = q.voiceChannel;
    if (!channel) {
      await cleanupQueue(guildId);
      return;
    }
    try {
      const fetched = await q.textChannel.guild.channels.fetch(channel.id);
      const members = fetched.members.filter(m => !m.user.bot);
      if (members.size === 0) {
        try {
          await q.textChannel.send({
            embeds: [new EmbedBuilder().setColor("#FFA500").setDescription("Leaving voice channel due to inactivity (2 min).")]
          });
        } catch (e) {}
        await cleanupQueue(guildId);
      } else {
        startInactivityCheck(q, guildId);
      }
    } catch (e) {
      await cleanupQueue(guildId);
    }
  }, 2 * 60 * 1000);
}

async function sendNowPlaying(queue, guildId) {
  const song = queue.currentSong;
  if (!song) return;

  const elapsed = queue.currentResource?.playbackDuration
    ? Math.floor(queue.currentResource.playbackDuration / 1000)
    : 0;
  const progress = buildProgressBar(elapsed, song.duration);

  const nextList =
    queue.songs
      .slice(0, 3)
      .map((s, i) => `\`${i + 1}.\` ${s.title} \`[${formatDuration(s.duration)}]\``)
      .join("\n") || "*Autoplay active — random track queued next*";

  const loopText = queue.loop === "track" ? "🔂 Track" : queue.loop === "queue" ? "🔁 Queue" : "Off";
  const autoplayText = queue.autoplay ? `🎲 ${AUTOPLAY_GENRES[queue.autoplayGenre]?.label || "On"}` : "Off";
  const shuffleText = queue.shuffle ? "On" : "Off";
  const filterText = queue.currentFilter && queue.currentFilter !== "none" ? AUDIO_FILTERS[queue.currentFilter]?.label || queue.currentFilter : "None";
  const volumeBar = createVolumeBar(Math.round(queue.volume * 100));

  const embed = new EmbedBuilder()
    .setColor("#5865F2")
    .setAuthor({ name: "Now Playing" })
    .setTitle(song.title)
    .setURL(song.url)
    .setThumbnail(song.thumbnail || null)
    .setDescription(`\`${formatDuration(elapsed)}\` ${progress} \`${formatDuration(song.duration)}\``)
    .addFields(
      { name: "Source", value: `\`${song.source || "YouTube"}\``, inline: true },
      { name: "Volume", value: `\`${volumeBar}\``, inline: true },
      { name: "Filter", value: `\`${filterText}\``, inline: true },
      { name: "Loop", value: `\`${loopText}\``, inline: true },
      { name: "Shuffle", value: `\`${shuffleText}\``, inline: true },
      { name: "Autoplay", value: `\`${autoplayText}\``, inline: true },
      { name: "Up Next", value: nextList, inline: false }
    )
    .setFooter({ text: `${queue.songs.length} track(s) in queue • Session: ${queue.sessionId.slice(0, 6)}` });

  const rows = buildControlButtons(queue);
  let message;
  try {
    message = await queue.textChannel.send({ embeds: [embed], components: rows });
  } catch (e) {
    return;
  }

  queue.nowPlayingMsg = message;

  if (queue.collector) {
    try { queue.collector.stop(); } catch (e) {}
  }

  queue.collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: Math.max((song.duration + 120) * 1000, 300000)
  });

  queue.collector.on("collect", async (btn) => {
    const q = queues.get(guildId);
    if (!q || btn.message.id !== message.id) {
      await btn.deferUpdate().catch(() => {});
      return;
    }

    await btn.deferUpdate().catch(() => {});

    if (btn.customId === "music_pause") {
      if (q.paused) {
        q.player.unpause();
        q.paused = false;
      } else {
        q.player.pause();
        q.paused = true;
      }
      try { await message.edit({ components: buildControlButtons(q) }); } catch (e) {}
    } else if (btn.customId === "music_prev") {
      if (q.previousTracks && q.previousTracks.length > 0) {
        if (q.currentSong) q.songs.unshift(q.currentSong);
        const prevSong = q.previousTracks.pop();
        q.currentSong = prevSong;
        try { await message.edit({ components: buildControlButtons(q) }); } catch (e) {}
        await playFromPosition(guildId, 0);
      }
    } else if (btn.customId === "music_skip") {
      q.player.stop();
    } else if (btn.customId === "music_stop") {
      try {
        await queue.textChannel.send({
          embeds: [new EmbedBuilder().setColor("#ED4245").setDescription("Playback stopped.")]
        });
      } catch (e) {}
      clearPlayerState(guildId);
      await cleanupQueue(guildId);
    } else if (btn.customId === "music_queue") {
      const queueList =
        q.songs
          .slice(0, 10)
          .map((s, i) => `\`${i + 1}.\` ${s.title} \`[${formatDuration(s.duration)}]\``)
          .join("\n") || "*Queue is empty*";
      try {
        await btn.followUp({
          embeds: [
            new EmbedBuilder()
              .setColor("#5865F2")
              .setTitle("Music Queue")
              .setDescription(queueList)
              .setFooter({ text: `${q.songs.length} track(s) remaining` })
          ],
          flags: 64
        });
      } catch (e) {}
    } else if (btn.customId === "music_shuffle") {
      q.shuffle = !q.shuffle;
      if (q.shuffle && q.songs.length > 1) {
        for (let i = q.songs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [q.songs[i], q.songs[j]] = [q.songs[j], q.songs[i]];
        }
      }
      savePlayerState(guildId, q);
      try { await message.edit({ components: buildControlButtons(q) }); } catch (e) {}
    } else if (btn.customId === "music_seek") {
      const modal = new ModalBuilder().setCustomId("seek_modal").setTitle("Seek to Position");
      const input = new TextInputBuilder()
        .setCustomId("seek_input")
        .setLabel("Position (mm:ss or seconds)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. 1:30 or 90")
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      try { await btn.showModal(modal); } catch (e) {}
      try {
        const filter = (i) => i.customId === "seek_modal";
        const modalInt = await btn.awaitModalSubmit({ filter, time: 30000 });
        const seekSec = parseSeekTime(modalInt.fields.getTextInputValue("seek_input"));
        if (seekSec === null || seekSec < 0) {
          await modalInt.reply({ embeds: [new EmbedBuilder().setColor("#ED4245").setDescription("Invalid time format.")], flags: 64 });
          return;
        }
        await modalInt.reply({ embeds: [new EmbedBuilder().setColor("#57F287").setDescription(`Seeking to \`${formatDuration(seekSec)}\``)], flags: 64 });
        await playFromPosition(guildId, seekSec);
      } catch (e) {}
    } else if (btn.customId === "music_volume") {
      const modal = new ModalBuilder().setCustomId("volume_modal").setTitle("Set Volume");
      const input = new TextInputBuilder()
        .setCustomId("volume_input")
        .setLabel("Volume (0-100)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Enter 0-100")
        .setMinLength(1).setMaxLength(3).setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      try { await btn.showModal(modal); } catch (e) {}
      try {
        const filter = (i) => i.customId === "volume_modal";
        const modalInt = await btn.awaitModalSubmit({ filter, time: 30000 });
        const val = parseInt(modalInt.fields.getTextInputValue("volume_input"));
        if (!isNaN(val) && val >= 0 && val <= 100) {
          q.volume = val / 100;
          if (q.currentResource?.volume) q.currentResource.volume.setVolume(q.volume);
          savePlayerState(guildId, q);
          const vBar = createVolumeBar(val);
          await modalInt.reply({ embeds: [new EmbedBuilder().setColor("#57F287").setDescription(`Volume set to \`${vBar}\``)], flags: 64 });
          try { await message.edit({ components: buildControlButtons(q) }); } catch (e) {}
        } else {
          await modalInt.reply({ embeds: [new EmbedBuilder().setColor("#ED4245").setDescription("Invalid volume. Enter 0-100.")], flags: 64 });
        }
      } catch (e) {}
    } else if (btn.customId === "music_filter") {
    } else if (btn.customId === "music_filter") {
      const filterKeys = Object.keys(AUDIO_FILTERS);
      const filterRow = new ActionRowBuilder();
      for (const key of filterKeys) {
        const f = AUDIO_FILTERS[key];
        filterRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`filter_${key}`)
            .setLabel(f.label)
            .setEmoji(f.emoji)
            .setStyle((q.currentFilter === key || (!q.currentFilter && key === "none")) ? ButtonStyle.Success : ButtonStyle.Secondary)
        );
      }
      try {
        await btn.followUp({ embeds: [new EmbedBuilder().setColor("#5865F2").setTitle("Audio Filter").setDescription("Select an audio filter:")], components: [filterRow], flags: 64 });
        const filterColl = message.channel.createMessageComponentCollector({ filter: (i) => i.customId.startsWith("filter_"), time: 30000, max: 1 });
        filterColl.on("collect", async (fBtn) => {
          const filterKey = fBtn.customId.replace("filter_", "");
          q.currentFilter = filterKey;
          savePlayerState(guildId, q);
          await fBtn.update({ embeds: [new EmbedBuilder().setColor("#57F287").setDescription(`Filter set to: **${AUDIO_FILTERS[filterKey]?.label || filterKey}**`)], components: [] });
          try { await message.edit({ components: buildControlButtons(q) }); } catch (e) {}
        });
      } catch (e) {}
    } else if (btn.customId === "music_loop") {
      if (q.loop === "off") q.loop = "track";
      else if (q.loop === "track") q.loop = "queue";
      else q.loop = "off";
      try { await message.edit({ components: buildControlButtons(q) }); } catch (e) {}
    } else if (btn.customId === "music_autoplay") {
      if (q.autoplay) {
        q.autoplay = false;
        q.autoplayGenre = null;
        savePlayerState(guildId, q);
        try { await message.edit({ components: buildControlButtons(q) }); } catch (e) {}
      } else {
        try {
          await btn.followUp({
            embeds: [new EmbedBuilder().setColor("#5865F2").setTitle("Select Autoplay Genre").setDescription("Choose a genre for autoplay:")],
            components: buildGenreButtons(),
            flags: 64
          });
          const genreFilter = (i) => i.customId.startsWith("genre_");
          q.genreCollector = message.channel.createMessageComponentCollector({
            filter: genreFilter,
            time: 30000,
            max: 1
          });
          q.genreCollector.on("collect", async (genreBtn) => {
            const genre = genreBtn.customId.replace("genre_", "");
            if (AUTOPLAY_GENRES[genre]) {
              q.autoplay = true;
              q.autoplayGenre = genre;
              savePlayerState(guildId, q);
              try {
                await genreBtn.update({
                  embeds: [new EmbedBuilder().setColor("#57F287").setDescription(`Autoplay enabled: **${AUTOPLAY_GENRES[genre].emoji} ${AUTOPLAY_GENRES[genre].label}**`)],
                  components: []
                });
              } catch (e) {}
              try { await message.edit({ components: buildControlButtons(q) }); } catch (e) {}
            }
          });
          q.genreCollector.on("end", (collected) => {
            if (collected.size === 0) {
              q.autoplay = false;
              q.autoplayGenre = null;
            }
          });
        } catch (e) {}
      }
    } else if (btn.customId === "music_lyrics") {
      try {
        await btn.followUp({ content: "Fetching lyrics...", flags: 64 });
        const lyrics = await getLyricsWithFallback(q.currentSong.title);
        if (lyrics && lyrics.plain) {
          const pages = [];
          const lines = lyrics.plain.split("\n");
          let current = "";
          for (const line of lines) {
            if (current.length + line.length > 1900) { pages.push(current); current = line + "\n"; }
            else current += line + "\n";
          }
          if (current.trim()) pages.push(current);

          const maxPages = Math.min(pages.length, 4);
          for (let i = 0; i < maxPages; i++) {
            await btn.followUp({
              embeds: [new EmbedBuilder().setColor("#5865F2").setTitle(`🎤 Lyrics (${i + 1}/${maxPages}): ${q.currentSong.title}`).setDescription(pages[i]).setFooter({ text: `Source: ${lyrics.source}` })],
              flags: 64
            });
          }
        } else {
          await btn.followUp({ embeds: [new EmbedBuilder().setColor("#ED4245").setDescription("No lyrics found for this track.")], flags: 64 });
        }
      } catch (e) {}
    }
  });

  queue.collector.on("end", () => {
    const q = queues.get(guildId);
    if (q && q.nowPlayingMsg?.id === message.id) {
      try {
        const disabledRows = buildControlButtons({ ...q, paused: true });
        disabledRows.forEach(row => row.components.forEach(c => c.setDisabled(true)));
        message.edit({ components: disabledRows }).catch(() => {});
      } catch (e) {}
    }
  });
}

async function startConnectionRecovery(queue, guildId) {
  if (queue.recovering) return;
  queue.recovering = true;
  queue.recoveryAttempts = 0;

  if (queue.recoveryInterval) clearInterval(queue.recoveryInterval);

  queue.recoveryInterval = setInterval(async () => {
    queue.recoveryAttempts++;
    if (queue.recoveryAttempts > 5) {
      clearInterval(queue.recoveryInterval);
      queue.recovering = false;
      return;
    }

    try {
      const channel = await queue.textChannel.guild.channels.fetch(queue.voiceChannel.id).catch(() => null);
      if (!channel) {
        clearInterval(queue.recoveryInterval);
        queue.recovering = false;
        await cleanupQueue(guildId);
        return;
      }

      queue.connection.destroy();
      queue.connection = joinVoiceChannel({
        channelId: queue.voiceChannel.id,
        guildId: queue.voiceChannel.guild.id,
        adapterCreator: queue.voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: false,
        daveEncryption: false
      });

      queue.connection.on("stateChange", function (oldState, newState) {
        if (newState.status === VoiceConnectionStatus.Disconnected) {
          if (!queue.recovering) {
            startConnectionRecovery(queue, guildId);
          }
        }
      });

      await entersState(queue.connection, VoiceConnectionStatus.Ready, 15000);
      queue.connection.subscribe(queue.player);

      if (queue.currentSong) {
        const elapsed = queue.currentResource?.playbackDuration
          ? Math.floor(queue.currentResource.playbackDuration / 1000)
          : 0;
        await playFromPosition(guildId, elapsed);
      }

      clearInterval(queue.recoveryInterval);
      queue.recovering = false;
    } catch (e) {
      console.error("[Play] Recovery attempt failed:", e.message);
    }
  }, 3000);
}

async function playFromPosition(guildId, startSeconds) {
  const queue = queues.get(guildId);
  if (!queue || !queue.currentSong) return;

  const filePath = queue.currentFilePath;
  if (!filePath || !fs.existsSync(filePath)) {
    return playNext(guildId);
  }

  try {
    queue.paused = false;
    const resource = createAudioResource(filePath, {
      inlineVolume: true,
      seek: startSeconds || 0
    });
    resource.volume.setVolume(queue.volume || 1.0);
    queue.player.play(resource);
    queue.currentResource = resource;

    await sendNowPlaying(queue, guildId);
  } catch (error) {
    console.error("[Play] Resume error:", error.message);
    playNext(guildId);
  }
}

async function playNext(guildId) {
  const queue = queues.get(guildId);
  if (!queue) return;

  if (queue.checkInterval) {
    clearInterval(queue.checkInterval);
    queue.checkInterval = null;
  }
  if (queue.collector) {
    try { queue.collector.stop(); } catch (e) {}
    queue.collector = null;
  }
  if (queue.currentDir) {
    try { await global.scraper.ytdpl.cleanup(queue.currentDir); } catch (e) {}
    queue.currentDir = null;
  }

  if (queue.songs.length === 0 && !queue.nextFilePath) {
    await enqueueAutoplay(queue);

    if (queue.songs.length === 0) {
      try {
        await queue.textChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor("#ED4245")
              .setDescription("Could not find any recommended tracks. Leaving voice channel.")
          ]
        });
      } catch (e) {}
      await cleanupQueue(guildId);
      return;
    }
  }

  let filePath = queue.nextFilePath;
  let directory = queue.nextDir;

  if (filePath && fs.existsSync(filePath)) {
    queue.currentSong = queue.songs.shift();
    queue.currentDir = directory;
    queue.currentFilePath = filePath;
    queue.nextFilePath = null;
    queue.nextDir = null;
  } else {
    if (queue.songs.length === 0) {
      await cleanupQueue(guildId);
      return;
    }
    const nextSong = queue.songs.shift();
    queue.currentSong = nextSong;
    try {
      const downloader = global.scraper?.ytdpl;
      if (!downloader) throw new Error("Downloader not available.");
      const result = await downloader.download(nextSong.url, {
        audioOnly: true,
        audioFormat: "opus",
        format: "bestaudio/best"
      });
      if (!result || !result.files || result.files.length === 0) {
        throw new Error("Download failed.");
      }
      queue.currentDir = result.directory;
      queue.currentFilePath = result.files[0];
      queue.downloadedDirs.push(result.directory);
      filePath = result.files[0];
    } catch (error) {
      console.error("[Play] Download error:", error.message);
      try {
        await queue.textChannel.send(`Skipping unplayable track: **${nextSong.title}**`);
      } catch (e) {}
      return playNext(guildId);
    }
  }

  try {
    if (!fs.existsSync(filePath)) throw new Error("Audio file not found.");

    if (queue.currentSong) {
      queue.previousTracks.push(queue.currentSong);
      if (queue.previousTracks.length > 25) queue.previousTracks.shift();
      queue.history.push(queue.currentSong.url);
      if (queue.history.length > 50) queue.history.shift();
    }

    queue.paused = false;
    const filterArgs = (queue.currentFilter && queue.currentFilter !== "none" && AUDIO_FILTERS[queue.currentFilter]) ? AUDIO_FILTERS[queue.currentFilter].args : [];
    const resource = createAudioResource(filePath, { inlineVolume: true, ...filterArgs.length ? {} : {} });
    resource.volume.setVolume(queue.volume || 1.0);
    queue.player.play(resource);
    queue.currentResource = resource;

    await sendNowPlaying(queue, guildId);

    savePlayerState(guildId, queue);
    startInactivityCheck(queue, guildId);

    queue.checkInterval = setInterval(() => {
      const q = queues.get(guildId);
      if (!q || !q.currentSong || !resource) {
        clearInterval(queue.checkInterval);
        return;
      }
      const elapsed = resource.playbackDuration / 1000;
      const total = q.currentSong.duration;
      if (total <= 20 || total - elapsed <= 20) {
        preDownloadNext(guildId).catch(() => {});
        clearInterval(queue.checkInterval);
        queue.checkInterval = null;
      }
    }, 1000);
  } catch (error) {
    console.error("[Play] Stream setup error:", error.message);
    playNext(guildId);
  }
}

module.exports = {
  name: "p",
  description: "Play music from Spotify, YouTube, SoundCloud, or any supported URL",
  options: [
    {
      name: "query",
      type: 3,
      description: "Song title, Spotify URL, YouTube URL, SoundCloud URL, or direct audio link",
      required: true
    }
  ],

  getQueues() {
    return queues;
  },

  async handleButton(interaction) {
    const guildId = interaction.guildId;
    const queue = queues.get(guildId);
    if (!queue) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "No music is currently playing.", flags: 64 });
      }
      return;
    }

    if (!interaction.replied && !interaction.deferred) {
      await interaction.deferUpdate().catch(() => {});
    }

    if (interaction.customId === "music_pause") {
      if (queue.paused) {
        queue.player.unpause();
        queue.paused = false;
      } else {
        queue.player.pause();
        queue.paused = true;
      }
      try {
        await interaction.message.edit({ components: buildControlButtons(queue) });
      } catch (e) {}
    } else if (interaction.customId === "music_prev") {
      if (queue.previousTracks && queue.previousTracks.length > 0) {
        if (queue.currentSong) queue.songs.unshift(queue.currentSong);
        const prevSong = queue.previousTracks.pop();
        queue.currentSong = prevSong;
        try { await interaction.message.edit({ components: buildControlButtons(queue) }); } catch (e) {}
        await playFromPosition(guildId, 0);
      }
    } else if (interaction.customId === "music_skip") {
      queue.player.stop();
    } else if (interaction.customId === "music_stop") {
      try {
        await queue.textChannel.send({
          embeds: [new EmbedBuilder().setColor("#ED4245").setDescription("Playback stopped.")]
        });
      } catch (e) {}
      await cleanupQueue(guildId);
    } else if (interaction.customId === "music_queue") {
      const queueList =
        queue.songs
          .slice(0, 10)
          .map((s, i) => `\`${i + 1}.\` ${s.title} \`[${formatDuration(s.duration)}]\``)
          .join("\n") || "*Queue is empty*";
      try {
        await interaction.followUp({
          embeds: [
            new EmbedBuilder()
              .setColor("#5865F2")
              .setTitle("Music Queue")
              .setDescription(queueList)
              .setFooter({ text: `${queue.songs.length} track(s) remaining` })
          ],
          flags: 64
        });
      } catch (e) {}
    } else if (interaction.customId === "music_shuffle") {
      queue.shuffle = !queue.shuffle;
      if (queue.shuffle && queue.songs.length > 1) {
        for (let i = queue.songs.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [queue.songs[i], queue.songs[j]] = [queue.songs[j], queue.songs[i]];
        }
      }
      savePlayerState(guildId, queue);
      try { await interaction.message.edit({ components: buildControlButtons(queue) }); } catch (e) {}
    } else if (interaction.customId === "music_seek") {
      const modal = new ModalBuilder().setCustomId("seek_modal").setTitle("Seek to Position");
      const input = new TextInputBuilder()
        .setCustomId("seek_input")
        .setLabel("Position (mm:ss or seconds)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("e.g. 1:30 or 90")
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      try { await interaction.showModal(modal); } catch (e) {}
    } else if (interaction.customId === "music_volume") {
      const modal = new ModalBuilder()
        .setCustomId("volume_modal")
        .setTitle("Set Volume");
      const input = new TextInputBuilder()
        .setCustomId("volume_input")
        .setLabel("Volume (0-100)")
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("Enter 0-100")
        .setMinLength(1)
        .setMaxLength(3)
        .setRequired(true);
      modal.addComponents(new ActionRowBuilder().addComponents(input));
      try { await interaction.showModal(modal); } catch (e) {}
    } else if (interaction.customId === "music_loop") {
      if (queue.loop === "off") queue.loop = "track";
      else if (queue.loop === "track") queue.loop = "queue";
      else queue.loop = "off";
      savePlayerState(guildId, queue);
      try { await interaction.message.edit({ components: buildControlButtons(queue) }); } catch (e) {}
    } else if (interaction.customId === "music_lyrics") {
      try {
        const lyrics = await getLyricsWithFallback(queue.currentSong.title);
        if (lyrics && lyrics.plain) {
          const pages = [];
          const lines = lyrics.plain.split("\n");
          let current = "";
          for (const line of lines) {
            if (current.length + line.length > 1900) { pages.push(current); current = line + "\n"; }
            else current += line + "\n";
          }
          if (current.trim()) pages.push(current);
          const maxPages = Math.min(pages.length, 4);
          for (let i = 0; i < maxPages; i++) {
            await interaction.followUp({
              embeds: [new EmbedBuilder().setColor("#5865F2").setTitle(`🎤 Lyrics (${i + 1}/${maxPages}): ${queue.currentSong.title}`).setDescription(pages[i]).setFooter({ text: `Source: ${lyrics.source}` })],
              flags: 64
            });
          }
        } else {
          await interaction.followUp({ embeds: [new EmbedBuilder().setColor("#ED4245").setDescription("No lyrics found for this track.")], flags: 64 });
        }
      } catch (e) {}
    }
  },

  async execute(interaction) {
    process.stderr.write("[Play] execute called for: " + (interaction.options?.getString("query") || "unknown") + "\n");
    try { await interaction.deferReply(); } catch (e) { return; }
    process.stderr.write("[Play] deferred reply\n");

    const guild = interaction.guild;
    let member = interaction.member;
    let channel = member?.voice?.channel;

    if (!channel) {
      try {
        member = await guild.members.fetch(interaction.user.id);
        channel = member?.voice?.channel;
      } catch (err) {}
    }

    if (!channel) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ED4245")
            .setDescription("You must be in a voice channel to use this command.")
        ]
      });
    }

    const permissions = channel.permissionsFor(guild.members.me);
    if (!permissions || !permissions.has("Connect") || !permissions.has("Speak")) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ED4245")
            .setDescription("I need **Connect** and **Speak** permissions in the voice channel.")
        ]
      });
    }

      const query = interaction.options.getString("query");
      process.stderr.write("[Play] Query: " + query + "\n");

      try {
      const downloader = global.scraper?.ytdpl;
      if (!downloader) throw new Error("Downloader not available.");
      process.stderr.write("[Play] Downloader available: " + !!downloader + "\n");

      const isSpotify = /open\.spotify\.com\/(track|album|playlist)|spotify\.link\//i.test(query);
      const isSoundCloud = /soundcloud\.com/i.test(query);
      const isDirect = /^https?:\/\/.+\.(mp3|wav|ogg|flac|m4a|aac|opus)(\?|$)/i.test(query);
      const isUrl = /^https?:\/\//i.test(query);

      let targetQuery;
      let source = "YouTube";

      if (isSpotify) {
        targetQuery = query;
        source = "Spotify";
      } else if (isSoundCloud) {
        targetQuery = query;
        source = "SoundCloud";
      } else if (isDirect) {
        targetQuery = query;
        source = "Direct";
      } else if (isUrl) {
        targetQuery = query;
        source = "URL";
      } else {
        targetQuery = "ytsearch1:" + query;
        source = "YouTube";
      }

      process.stderr.write("[Play] Fetching metadata for: " + targetQuery + "\n");
      const metadata = await downloader.getMetadata(targetQuery);
      process.stderr.write("[Play] Metadata received: " + !!metadata + "\n");
      if (!metadata) throw new Error("Track not found.");

      let info = Array.isArray(metadata) ? metadata[0] : metadata;
      if (!info || !info.id) throw new Error("Invalid track data.");

      const song = {
        title: info.title || "Unknown",
        url: info.webpage_url || info.url || info.original_url,
        thumbnail: info.thumbnail || "",
        duration: info.duration || 0,
        uploader: info.uploader || info.channel || "Unknown",
        requester: `<@${interaction.user.id}>`,
        source: source
      };

      const guildId = interaction.guildId;
      let queue = queues.get(guildId);

      if (!queue) {
        process.stderr.write("[Play] Joining voice channel: " + channel.name + " (" + channel.id + ")\n");

        const connection = joinVoiceChannel({
          channelId: channel.id,
          guildId: channel.guild.id,
          adapterCreator: channel.guild.voiceAdapterCreator,
          selfDeaf: true,
          selfMute: false,
          daveEncryption: false
        });

        connection.on("stateChange", function (oldState, newState) {
          process.stderr.write("[Play] Voice state: " + oldState.status + " -> " + newState.status + "\n");
          if (newState.status === VoiceConnectionStatus.Disconnected) {
            process.stderr.write("[Play] Disconnected. Close code: " + newState.closeCode + " Reason: " + newState.reason + "\n");
            if (!queue.recovering) {
              startConnectionRecovery(queue, guildId);
            }
          }
        });

        connection.on("debug", function (msg) {
          process.stderr.write("[Play] VoiceDebug: " + msg + "\n");
        });

        connection.on("error", function (err) {
          process.stderr.write("[Play] VoiceConnection error: " + err.message + "\n");
        });

        try {
          await entersState(connection, VoiceConnectionStatus.Ready, 30000);
          process.stderr.write("[Play] Voice connected successfully!\n");
        } catch (err) {
          process.stderr.write("[Play] entersState failed. Current status: " + connection.state.status + "\n");
          if (connection.state.status === "signalling") {
            process.stderr.write("[Play] Stuck in Signalling - WebSocket connected but UDP/IP discovery failing\n");
          }
          connection.destroy();
          throw new Error("Failed to connect to voice channel.");
        }

        const player = createAudioPlayer({
          behaviors: { noSubscriber: NoSubscriberBehavior.Play }
        });

        connection.subscribe(player);

        player.on(AudioPlayerStatus.Idle, function () {
          const q = queues.get(guildId);
          if (!q) return;

          if (q.loop === "track" && q.currentSong) {
            playFromPosition(guildId, 0);
          } else if (q.loop === "queue" && q.currentSong) {
            q.songs.push({ ...q.currentSong });
            playNext(guildId);
          } else {
            playNext(guildId);
          }
        });

        player.on("error", function (err) {
          console.error("[Play] Player error:", err.message);
          const q = queues.get(guildId);
          if (q) playNext(guildId);
        });

        queue = {
          voiceChannel: channel,
          textChannel: interaction.channel,
          connection,
          player,
          songs: [],
          currentSong: null,
          currentResource: null,
          currentDir: null,
          currentFilePath: null,
          nextFilePath: null,
          nextDir: null,
          isDownloadingNext: false,
          autoplayFetching: false,
          checkInterval: null,
          idleTimer: null,
          recoveryInterval: null,
          recovering: false,
          recoveryAttempts: 0,
          collector: null,
          genreCollector: null,
          nowPlayingMsg: null,
          history: [],
          previousTracks: [],
          downloadedDirs: [],
          volume: 1.0,
          paused: false,
          loop: "off",
          shuffle: false,
          autoplay: false,
          autoplayGenre: null,
          currentFilter: "none",
          sessionId: Date.now().toString(36) + Math.random().toString(36).substr(2)
        };

        queues.set(guildId, queue);
      } else {
        queue.voiceChannel = channel;
        queue.textChannel = interaction.channel;
      }

      const isFirst = queue.songs.length === 0 && !queue.currentSong;
      queue.songs.push(song);

      if (!isFirst) {
        const position = queue.songs.length;
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#5865F2")
              .setTitle("Added to Queue")
              .setDescription(`[${song.title}](${song.url})`)
              .setThumbnail(song.thumbnail || null)
              .addFields(
                { name: "Duration", value: `\`[${formatDuration(song.duration)}]\``, inline: true },
                { name: "Source", value: `\`${song.source}\``, inline: true },
                { name: "Position", value: `\`#${position}\``, inline: true }
              )
          ]
        });
        return;
      }

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#57F287")
            .setDescription(`Loading: **${song.title}**...`)
        ]
      });

      const nextSong = queue.songs.shift();
      queue.currentSong = nextSong;

      const result = await downloader.download(nextSong.url, {
        audioOnly: true,
        audioFormat: "opus",
        format: "bestaudio/best"
      });

      if (!result || !result.files || result.files.length === 0) {
        throw new Error("Download failed.");
      }

      queue.currentDir = result.directory;
      queue.currentFilePath = result.files[0];
      queue.downloadedDirs.push(result.directory);
      const filePath = result.files[0];

      if (!fs.existsSync(filePath)) throw new Error("Audio file not found.");

      queue.history.push(queue.currentSong.url);

      queue.paused = false;
      const resource = createAudioResource(filePath, { inlineVolume: true });
      resource.volume.setVolume(queue.volume || 1.0);
      queue.player.play(resource);
      queue.currentResource = resource;

      await sendNowPlaying(queue, guildId);

      startInactivityCheck(queue, guildId);

      queue.checkInterval = setInterval(() => {
        const q = queues.get(guildId);
        if (!q || !q.currentSong || !resource) {
          clearInterval(queue.checkInterval);
          return;
        }
        const elapsed = resource.playbackDuration / 1000;
        const total = q.currentSong.duration;
        if (total <= 20 || total - elapsed <= 20) {
          preDownloadNext(guildId).catch(() => {});
          clearInterval(queue.checkInterval);
          queue.checkInterval = null;
        }
      }, 1000);
    } catch (error) {
      console.error("[Play] Error:", error);
      try {
        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor("#ED4245")
              .setDescription(`Error: ${error.message}`)
          ]
        });
      } catch (e) {}
    }
  }
};
