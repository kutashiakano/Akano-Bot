const { joinVoiceChannel, getVoiceConnection, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState, NoSubscriberBehavior } = require("@discordjs/voice");
const fs = require("fs");
const path = require("path");
const dns = require("dns");

dns.setDefaultResultOrder("ipv4first");

const { formatDuration, parseSeekTime, AUDIO_FILTERS } = require("./utils");
const {
  controlButtons,
  genreButtons,
  nowPlaying,
  queued,
} = require("./embeds");

function B(o) {
  const c = o?.client || o?.textChannel?.client || null;
  return c || {};
}
const { lyrAny } = require("./lyrics");
const { AUTOPLAY_GENRES, smartRec, autoFill } = require("./autoplay");
const emojis = require("./emojis.js");
const ys = require("../../../../scrapers/src/ytsession.js");
const ytmusic = require("../../../../scrapers/src/ytmusic.js");
const {
  svState,
  ldState,
  clrState,
  ldAllState,
} = require("./state");

const queues = new Map();

async function clearQ(guildId) {
  const queue = queues.get(guildId);
  if (!queue) return;
  queues.delete(guildId);
  clrState(guildId);
  if (queue.ckTimer) clearInterval(queue.ckTimer);
  if (queue.idleTimer) clearTimeout(queue.idleTimer);
  if (queue.rTimer) clearInterval(queue.rTimer);
  if (queue.progressTimer) clearInterval(queue.progressTimer);
  if (queue.collector)
    try {
      queue.collector.stop();
    } catch (e) {}
  if (queue.genreCollector)
    try {
      queue.genreCollector.stop();
    } catch (e) {}
  try {
    queue.player.stop(true);
  } catch (e) {}
  try {
    queue.connection.destroy();
  } catch (e) {}
  if (queue.curDir) {
    try {
      await global.scraper.ytdpl.cleanup(queue.curDir);
    } catch (e) {}
  }
  if (queue.nxtDir) {
    try {
      await global.scraper.ytdpl.cleanup(queue.nxtDir);
    } catch (e) {}
  }
  for (const dir of queue.dlDirs || []) {
    try {
      await global.scraper.ytdpl.cleanup(dir);
    } catch (e) {}
  }
}

function startProgressTimer(queue, guildId, message) {
  if (queue.progressTimer) clearInterval(queue.progressTimer);
  queue.progressTimer = setInterval(() => {
    const q = queues.get(guildId);
    if (!q || !q.currentSong || !q.currentResource) {
      clearInterval(queue.progressTimer);
      return;
    }
    const elapsed = Math.floor(q.currentResource.playbackDuration / 1000);
    if (q.nowPlayingMsg?.id === message?.id) {
      const embed = nowPlaying(q, elapsed);
      message.edit({ embeds: [embed] }).catch(() => {});
    }
  }, 10000);
}

function stopProgressTimer(queue) {
  if (queue.progressTimer) {
    clearInterval(queue.progressTimer);
    queue.progressTimer = null;
  }
}

function isSpotifyUrl(url) {
  return /open\.spotify\.com\/(track|album|playlist)|spotify\.link\//i.test(String(url || ""));
}

async function downloadSongFile(song, options = {}) {
  const spotify = global.scraper?.spotify;
  if (isSpotifyUrl(song.url) && spotify) {
    return spotify.download(song.url, options);
  }
  const downloader = global.scraper?.ytdpl;
  if (!downloader) throw new Error("Downloader not available.");
  return downloader.download(song.url, {
    audioOnly: true,
    audioFormat: "opus",
    format: "bestaudio/best",
    ...options,
  });
}

async function dlNext(guildId) {
  const queue = queues.get(guildId);
  if (!queue || queue.dlNextFlag || queue.nxtFp) return;

  if (queue.songs.length === 0) {
    await autoFill(queue);
  }

  if (queue.songs.length === 0) return;

  queue.dlNextFlag = true;
  try {
    const downloader = global.scraper?.ytdpl;
    const nextSong = queue.songs[0];

    let file = null;
    try {
      if (downloader) file = await downloader.getCachedFile(nextSong.url);
    } catch (e) {}

    if (file && fs.existsSync(file)) {
      queue.nxtFp = file;
      queue.nxtDir = null;
      return;
    }

    const result = await downloadSongFile(nextSong);
    if (result && result.files && result.files.length > 0) {
      queue.nxtFp = result.files[0];
      queue.nxtDir = result.directory;
      queue.dlDirs.push(result.directory);
      try {
        if (downloader) await downloader.cacheFile(nextSong.url, result.files[0]);
      } catch (e) {}
    }
  } catch (e) {
    global.logError("dc.music.predownload", e);
  } finally {
    queue.dlNextFlag = false;
  }
}

function idleChk(queue, guildId) {
  if (queue.idleTimer) clearTimeout(queue.idleTimer);
  queue.idleTimer = setTimeout(
    async () => {
      const q = queues.get(guildId);
      if (!q) return;
      const channel = q.voiceChannel;
      if (!channel) {
        await clearQ(guildId);
        return;
      }
      try {
        const fetched = await q.textChannel.guild.channels.fetch(channel.id);
        const members = fetched.members.filter((m) => !m.user.bot);
        if (members.size === 0) {
          try {
            await q.textChannel.send({
              embeds: [
                new B(q).ebuilder()
                  .setColor("#FFA500")
                  .setDescription("Leaving voice channel due to inactivity (2 min)."),
              ],
            });
          } catch (e) {}
          await clearQ(guildId);
        } else {
          idleChk(q, guildId);
        }
      } catch (e) {
        await clearQ(guildId);
      }
    },
    2 * 60 * 1000,
  );
}

async function np(queue, guildId) {
  const song = queue.currentSong;
  if (!song) return;

  const elapsed = queue.currentResource?.playbackDuration
    ? Math.floor(queue.currentResource.playbackDuration / 1000)
    : 0;

  const embed = nowPlaying(queue, elapsed);
  const rows = controlButtons(queue);
  let message;
  try {
    message = await queue.textChannel.send({ embeds: [embed], components: rows });
  } catch (e) {
    return;
  }

  queue.nowPlayingMsg = message;
  startProgressTimer(queue, guildId, message);

  if (queue.collector) {
    try {
      queue.collector.stop();
    } catch (e) {}
  }

  queue.collector = message.createMessageComponentCollector({
    filter: (i) => !String(i.customId || "").startsWith("music_"),
    componentType: 2,
    time: Math.max((song.duration + 120) * 1000, 300000),
  });

  queue.collector.on("collect", async (btn) => {
    const q = queues.get(guildId);
    if (!q || btn.message.id !== message.id) {
      await btn.deferUpdate().catch(() => {});
      return;
    }
    await onMusicBtn(q, guildId, btn, message);
  });

  queue.collector.on("end", () => {
    const q = queues.get(guildId);
    if (q && q.nowPlayingMsg?.id === message.id) {
      try {
        const disabledRows = controlButtons({ ...q, paused: true });
        disabledRows.forEach((row) => row.components.forEach((c) => c.setDisabled(true)));
        message.edit({ components: disabledRows }).catch(() => {});
      } catch (e) {}
    }
  });
}

async function onMusicBtn(q, guildId, btn, message) {
  await btn.deferUpdate().catch(() => {});

  const CONTROLLABLE = [
    "music_pause",
    "music_prev",
    "music_skip",
    "music_stop",
    "music_seek",
    "music_volume",
    "music_loop",
    "music_shuffle",
    "music_filter",
    "music_autoplay",
    "music_like",
  ];
  if (CONTROLLABLE.includes(btn.customId)) {
    const requesterId = q.currentSong?.requesterId;
    const isRequester = requesterId && String(btn.user.id) === String(requesterId);
    const isAdmin = Boolean(
      btn.member?.permissions?.has("ManageGuild") || btn.member?.permissions?.has("Administrator"),
    );
    const isBotOwner = global.owner?.includes(String(btn.user.id));
    if (!isRequester && !isAdmin && !isBotOwner) {
      try {
        await btn.followUp({
          embeds: [
            new B(q).ebuilder()
              .setColor("#ED4245")
              .setDescription("Only the requester, admins, or the bot owner can control playback."),
          ],
          flags: 64,
        });
      } catch (e) {}
      return;
    }
  }

  if (btn.customId === "music_pause") {
    if (q.paused) {
      q.player.unpause();
      q.paused = false;
    } else {
      q.player.pause();
      q.paused = true;
    }
    try {
      await message.edit({ components: controlButtons(q) });
    } catch (e) {}
  } else if (btn.customId === "music_prev") {
    if (q.previousTracks && q.previousTracks.length > 0) {
      if (q.currentSong) q.songs.unshift(q.currentSong);
      const prevSong = q.previousTracks.pop();
      q.currentSong = prevSong;
      q.guestMode = !q.currentSong?.requesterId || !ys.has(q.currentSong.requesterId);
      try {
        await message.edit({ components: controlButtons(q) });
      } catch (e) {}
      await seekPlay(guildId, 0);
    }
  } else if (btn.customId === "music_skip") {
    q.player.stop();
  } else if (btn.customId === "music_stop") {
    try {
      await q.textChannel.send({
        embeds: [new B(q).ebuilder().setColor("#ED4245").setDescription("Playback stopped.")],
      });
    } catch (e) {}
    await clearQ(guildId);
  } else if (btn.customId === "music_queue") {
    const queueList =
      q.songs
        .slice(0, 10)
        .map((s, i) => `\`${i + 1}.\` ${s.title} \`[${formatDuration(s.duration)}]\``)
        .join("\n") || "*Queue is empty*";
    try {
      await btn.followUp({
        embeds: [
          new B(q).ebuilder()
            .setColor("#5865F2")
            .setTitle("Music Queue")
            .setDescription(queueList)
            .setFooter({ text: `${q.songs.length} track(s) remaining` }),
        ],
        flags: 64,
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
    svState(guildId, q);
    try {
      await message.edit({ components: controlButtons(q) });
    } catch (e) {}
  } else if (btn.customId === "music_seek") {
    const modal = new (B(q).modal)().setCustomId("seek_modal").setTitle("Seek to Position");
    const input = new (B(q).textInput)()
      .setCustomId("seek_input")
      .setLabel("Position (mm:ss or seconds)")
      .setStyle((B(q).TextInputStyle).Short)
      .setPlaceholder("e.g. 1:30 or 90")
      .setRequired(true);
    modal.addComponents(new (B(q).abuilder)().addComponents(input));
    try {
      await btn.showModal(modal);
    } catch (e) {}
    try {
      const filter = (i) => i.customId === "seek_modal";
      const modalInt = await btn.awaitModalSubmit({ filter, time: 30000 });
      const seekSec = parseSeekTime(modalInt.fields.getTextInputValue("seek_input"));
      if (seekSec === null || seekSec < 0) {
        await modalInt.reply({
          embeds: [new B(q).ebuilder().setColor("#ED4245").setDescription("Invalid time format.")],
          flags: 64,
        });
        return;
      }
      await modalInt.reply({
        embeds: [
          new B(q).ebuilder()
            .setColor("#57F287")
            .setDescription(`Seeking to \`${formatDuration(seekSec)}\``),
        ],
        flags: 64,
      });
      await seekPlay(guildId, seekSec);
    } catch (e) {}
  } else if (btn.customId === "music_volume") {
    const modal = new (B(q).modal)().setCustomId("volume_modal").setTitle("Set Volume");
    const input = new (B(q).textInput)()
      .setCustomId("volume_input")
      .setLabel("Volume (0-100)")
      .setStyle((B(q).TextInputStyle).Short)
      .setPlaceholder("Enter 0-100")
      .setMinLength(1)
      .setMaxLength(3)
      .setRequired(true);
    modal.addComponents(new (B(q).abuilder)().addComponents(input));
    try {
      await btn.showModal(modal);
    } catch (e) {}
    try {
      const filter = (i) => i.customId === "volume_modal";
      const modalInt = await btn.awaitModalSubmit({ filter, time: 30000 });
      const val = parseInt(modalInt.fields.getTextInputValue("volume_input"));
      if (!isNaN(val) && val >= 0 && val <= 100) {
        q.volume = val / 100;
        if (q.currentResource?.volume) q.currentResource.volume.setVolume(q.volume);
        svState(guildId, q);
        const bar =
          "▓".repeat(Math.round((val / 100) * 15)) +
          "░".repeat(15 - Math.round((val / 100) * 15)) +
          ` ${val}%`;
        await modalInt.reply({
          embeds: [
            new B(q).ebuilder().setColor("#57F287").setDescription(`Volume set to \`${bar}\``),
          ],
          flags: 64,
        });
        try {
          await message.edit({ components: controlButtons(q) });
        } catch (e) {}
      } else {
        await modalInt.reply({
          embeds: [
            new B(q).ebuilder().setColor("#ED4245").setDescription("Invalid volume. Enter 0-100."),
          ],
          flags: 64,
        });
      }
    } catch (e) {}
  } else if (btn.customId === "music_filter") {
    const filterKeys = Object.keys(AUDIO_FILTERS);
    const filterRow = new B(q).abuilder();
    for (const key of filterKeys) {
      const f = AUDIO_FILTERS[key];
      filterRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`filter_${key}`)
          .setLabel(f.label)
          .setStyle(
            q.currentFilter === key || (!q.currentFilter && key === "none")
              ? B(q).ButtonStyle.Success
              : B(q).ButtonStyle.Secondary,
          ),
      );
    }
    try {
      await btn.followUp({
        embeds: [
          new B(q).ebuilder()
            .setColor("#5865F2")
            .setTitle("Audio Filter")
            .setDescription("Select an audio filter:"),
        ],
        components: [filterRow],
        flags: 64,
      });
      const filterColl = btn.channel.createMessageComponentCollector({
        filter: (i) => i.customId.startsWith("filter_"),
        time: 30000,
        max: 1,
      });
      filterColl.on("collect", async (fBtn) => {
        const filterKey = fBtn.customId.replace("filter_", "");
        q.currentFilter = filterKey;
        svState(guildId, q);
        await fBtn.update({
          embeds: [
            new B(q).ebuilder()
              .setColor("#57F287")
              .setDescription(`Filter set to: **${AUDIO_FILTERS[filterKey]?.label || filterKey}**`),
          ],
          components: [],
        });
        try {
          await message.edit({ components: controlButtons(q) });
        } catch (e) {}
      });
    } catch (e) {}
  } else if (btn.customId === "music_loop") {
    if (q.loop === "off") q.loop = "track";
    else if (q.loop === "track") q.loop = "queue";
    else q.loop = "off";
    svState(guildId, q);
    try {
      await message.edit({ components: controlButtons(q) });
    } catch (e) {}
  } else if (btn.customId === "music_autoplay") {
    if (q.autoplay) {
      q.autoplay = false;
      q.autoplayGenre = null;
      svState(guildId, q);
      try {
        await message.edit({ components: controlButtons(q) });
      } catch (e) {}
    } else {
      try {
        await btn.followUp({
          embeds: [
            new B(q).ebuilder()
              .setColor("#5865F2")
              .setTitle("Select Autoplay Genre")
              .setDescription("Choose a genre for autoplay:"),
          ],
          components: genreButtons(q.textChannel.client, AUTOPLAY_GENRES),
          flags: 64,
        });
        const genreFilter = (i) => i.customId.startsWith("genre_");
        q.genreCollector = btn.channel.createMessageComponentCollector({
          filter: genreFilter,
          time: 30000,
          max: 1,
        });
        q.genreCollector.on("collect", async (genreBtn) => {
          const genre = genreBtn.customId.replace("genre_", "");
          if (AUTOPLAY_GENRES[genre]) {
            q.autoplay = true;
            q.autoplayGenre = genre;
            svState(guildId, q);
            try {
              await genreBtn.update({
                embeds: [
                  new B(q).ebuilder()
                    .setColor("#57F287")
                    .setDescription(`Autoplay enabled: **${AUTOPLAY_GENRES[genre].label}**`),
                ],
                components: [],
              });
            } catch (e) {}
            try {
              await message.edit({ components: controlButtons(q) });
            } catch (e) {}
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
      const lyrics = await lyrAny(q.currentSong.title);
      if (lyrics && lyrics.plain) {
        const pages = [];
        const lines = lyrics.plain.split("\n");
        let current = "";
        for (const line of lines) {
          if (current.length + line.length > 1900) {
            pages.push(current);
            current = line + "\n";
          } else current += line + "\n";
        }
        if (current.trim()) pages.push(current);

        const maxPages = Math.min(pages.length, 4);
        for (let i = 0; i < maxPages; i++) {
          await btn.followUp({
            embeds: [
              new B(q).ebuilder()
                .setColor("#5865F2")
                .setTitle(` Lyrics (${i + 1}/${maxPages}): ${q.currentSong.title}`)
                .setDescription(pages[i])
                .setFooter({ text: `Source: ${lyrics.source}` }),
            ],
            flags: 64,
          });
        }
      } else {
        await btn.followUp({
          embeds: [
            new B(q).ebuilder()
              .setColor("#ED4245")
              .setDescription("No lyrics found for this track."),
          ],
          flags: 64,
        });
      }
    } catch (e) {}
  } else if (btn.customId === "music_dashboard") {
    try {
      const now = q.currentSong;
      const embed = new B(q).ebuilder()
        .setColor("#5865F2")
        .setTitle("Music Dashboard")
        .setDescription(
          now
            ? `**Now Playing:** [${now.title}](${now.url}) — ${now.uploader || "Unknown"}\n\`Queue: ${q.songs.length} • Volume: ${Math.round((q.volume || 1) * 100)}% • Loop: ${q.loop} • Autoplay: ${q.autoplay ? "On" : "Off"}\``
            : "No track playing — use /p or /music to start."
        )
        .setThumbnail(now?.thumbnail || null);
      const vid = q.currentSong?.id || String(q.currentSong?.url || "").match(/[?&]v=([\w-]{6,})/)?.[1] || "";
      const isLiked = vid ? !!q.liked?.has(vid) : false;
      const row = new B(q).abuilder().addComponents(
        new B(q).bbuilder().setCustomId("music_dash_search").setLabel("Search").setStyle(B(q).ButtonStyle.Primary),
        new B(q).bbuilder().setCustomId("music_dash_queue").setLabel("Queue").setStyle(B(q).ButtonStyle.Secondary),
        new B(q).bbuilder().setCustomId("music_dash_like").setLabel(isLiked ? "Unlike" : "Like").setStyle(isLiked ? B(q).ButtonStyle.Success : B(q).ButtonStyle.Secondary)
      );
      const row2 = new B(q).abuilder().addComponents(
        new B(q).bbuilder().setCustomId("music_dash_addpl").setLabel("Add to Playlist").setStyle(B(q).ButtonStyle.Secondary),
        new B(q).bbuilder().setCustomId("music_dash_account").setLabel("Account").setStyle(B(q).ButtonStyle.Secondary)
      );
      await btn.followUp({ embeds: [embed], components: [row, row2], flags: 64 });
    } catch {}
  } else if (btn.customId === "music_like") {
    const song = q.currentSong;
    try {
      if (!song) {
        await btn.followUp({ content: "Nothing is playing right now.", flags: 64 });
        return;
      }
      const vid = song.id || String(song.url || "").match(/[?&]v=([\w-]{6,})/)?.[1];
      if (!vid) {
        await btn.followUp({ content: "Cannot like this track (missing video id).", flags: 64 });
        return;
      }
      const uid = song.requesterId || btn.user.id;
      let session = null;
      try {
        if (ys.has(uid)) session = await ys.getSession(uid);
      } catch (e) {}
      if (!session) {
        await btn.followUp({
          content: "Sign in first via /account login to like songs into your YouTube Music.",
          flags: 64,
        });
        return;
      }
      const likedNow = !(q.liked?.has(vid) || false);
      await ytmusic.like(session, vid, likedNow, ys.clientOf(uid));
      if (!q.liked) q.liked = new Set();
      if (likedNow) q.liked.add(vid);
      else q.liked.delete(vid);
      try {
        await message.edit({ components: controlButtons(q) });
      } catch (e) {}
      await btn.followUp({
        content: likedNow ? "Liked ✓ added to your YouTube Music." : "Unliked.",
        flags: 64,
      });
    } catch (e) {
      global.logError("dc.music.like", e);
      try {
        await btn.followUp({
          content: "Failed to like: " + (e.message || e),
          flags: 64,
        });
      } catch (err) {}
    }
  } else if (btn.customId === "music_dash_search") {
    const modal = new (B(q).modal)().setCustomId("music_dash_search_modal").setTitle("Search YouTube Music");
    const input = new (B(q).textInput)().setCustomId("music_dash_q").setLabel("Song, artist or album").setStyle((B(q).TextInputStyle).Short).setPlaceholder("e.g. YOASOBI - Idol").setRequired(true);
    modal.addComponents(new (B(q).abuilder)().addComponents(input));
    try { await btn.showModal(modal); } catch {}
    try {
      const sub = await btn.awaitModalSubmit({ filter: (i) => i.customId === "music_dash_search_modal" && i.user.id === btn.user.id, time: 60000 });
      const qstr = sub.fields.getTextInputValue("music_dash_q").trim();
      if (!qstr) return sub.reply({ content: "Empty query.", flags: 64 }).catch(() => {});
      await sub.deferReply({ flags: 64 }).catch(() => {});
      const ytm = global.scraper?.ytmusic;
      const hits = await ytm.searchType(qstr, "song", 10, null).catch(() => []);
      if (!hits.length) return sub.editReply({ content: "No results." }).catch(() => {});
      const row = new (sub.client.abuilder)().addComponents(
        new (sub.client.mbuilder)().setCustomId("music_dash_pick").setPlaceholder("Pick a song").addOptions(hits.slice(0, 10).map((h) => ({ label: String(h.title).slice(0, 80), description: String(h.artist).slice(0, 40), value: h.id })))
      );
      const embed = new (sub.client.ebuilder)().setColor("#5865F2").setTitle("Results for " + qstr).setDescription(hits.map((h, i) => `\`${i + 1}.\` **${h.title}** — ${h.artist}`).join("\n").slice(0, 3800));
      const msg = await sub.editReply({ embeds: [embed], components: [row] }).catch(() => null);
      if (!msg) return;
      const col = msg.createMessageComponentCollector({ filter: (i) => i.customId === "music_dash_pick" && i.user.id === btn.user.id, time: 60000, max: 1 });
      col.on("collect", async (sel) => {
        const vid = sel.values?.[0];
        const chosen = hits.find((h) => h.id === vid);
        if (!chosen) return sel.update({ content: "Expired.", embeds: [], components: [] }).catch(() => {});
        await sel.deferUpdate().catch(() => {});
        const play = require("./play.js");
        const res = await play.playPanel(sel, { videoId: chosen.id, title: chosen.title, thumbnail: chosen.thumbnail });
        if (res.error) await sel.followUp({ embeds: [res.error], flags: 64 }).catch(() => {});
        else if (res.embed) await sel.followUp({ embeds: [res.embed] }).catch(() => {});
      });
    } catch {}
  } else if (btn.customId === "music_dash_queue") {
    const list = q.songs.slice(0, 10).map((s, i) => `\`${i + 1}.\` ${s.title} \`[${formatDuration(s.duration)}]\``).join("\n") || "*Empty*";
    const now = q.currentSong ? `**Now:** [${q.currentSong.title}](${q.currentSong.url})\n\n` : "";
    const embed = new B(q).ebuilder().setColor("#5865F2").setTitle("Queue").setDescription(now + list).setFooter({ text: `${q.songs.length} queued` });
    await btn.followUp({ embeds: [embed], flags: 64 }).catch(() => {});
  } else if (btn.customId === "music_dash_account") {
    try {
      const acc = require("../tools/account.js");
      await acc.execute(btn).catch(() => {});
    } catch {}
  } else if (btn.customId === "music_dash_like") {
    const cur = q.currentSong;
    if (!cur) return btn.reply({ content: "No song playing.", flags: 64 }).catch(() => {});
    const vid = cur.id || String(cur.url || "").match(/[?&]v=([\w-]{6,})/)?.[1];
    if (!vid) return btn.reply({ content: "No video id.", flags: 64 }).catch(() => {});
    const uid = cur.requesterId || btn.user.id;
    let session = null;
    try { if (ys.has(uid)) session = await ys.getSession(uid); } catch {}
    if (!session) return btn.reply({ content: "Sign in via /account to like.", flags: 64 }).catch(() => {});
    const likedNow = !q.liked?.has(vid);
    try {
      await ytmusic.like(session, vid, likedNow, ys.clientOf(uid));
      if (!q.liked) q.liked = new Set();
      if (likedNow) q.liked.add(vid); else q.liked.delete(vid);
      await btn.reply({ content: likedNow ? "Liked ✓" : "Unliked.", flags: 64 }).catch(() => {});
    } catch (e) {
      await btn.reply({ content: "Like failed: " + (e.message || e), flags: 64 }).catch(() => {});
    }
  } else if (btn.customId === "music_dash_addpl") {
    const cur = q.currentSong;
    if (!cur) return btn.reply({ content: "No song playing.", flags: 64 }).catch(() => {});
    const vid = cur.id || String(cur.url || "").match(/[?&]v=([\w-]{6,})/)?.[1];
    if (!vid) return btn.reply({ content: "No video id.", flags: 64 }).catch(() => {});
    const plists = await ys.plists(btn.user.id, 25).catch(() => []);
    if (!plists.length) return btn.reply({ content: "No playlists — create one via /music → My Playlists → Create.", flags: 64 }).catch(() => {});
    const row = new (btn.client.abuilder)().addComponents(
      new (btn.client.mbuilder)().setCustomId("music_dash_addpl_pick:" + vid).setPlaceholder("Pick playlist to add").addOptions(plists.slice(0, 25).map((p) => ({ label: p.title.slice(0, 80), value: p.id })))
    );
    const embed = new (btn.client.ebuilder)().setColor("#5865F2").setTitle("Add to Playlist").setDescription(`**${cur.title}**\nPick a playlist:`);
    await btn.reply({ embeds: [embed], components: [row], flags: 64 }).catch(() => {});
  } else if (String(btn.customId || "").startsWith("music_dash_addpl_pick:")) {
    const vid = btn.customId.split(":")[1];
    const pid = btn.values?.[0];
    if (!pid) return;
    const ok = await ys.addPl(btn.user.id, pid, vid).catch(() => false);
    await btn.update({ content: ok ? "Added to playlist!" : "Failed to add.", embeds: [], components: [] }).catch(() => {});
  }
}

async function mkConn(voiceChannel, guildId, getQueue, attempts = 3) {
  let connection = null;
  let lastErr = null;

  const otherBot = voiceChannel.members.find((m) => {
    if (!m.user?.bot) return false;
    if (voiceChannel.client?.user && m.user.id === voiceChannel.client.user.id) return false;
    return true;
  });

  if (voiceChannel.members && otherBot) {
    throw new Error(
      `Another bot (${otherBot.user.username}) is already in this voice channel — I won't join to avoid conflict.`,
    );
  }

  const wire = (conn) => {
    conn.on("stateChange", function (oldState, newState) {
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        global.logError("dc.music.voice.disconnected", {
          message: "Closed (code " + (newState.closeCode || "n/a") + "): " + (newState.reason || "") ,
        });
        const q = getQueue();
        if (q && !q.recovering) {
          recoverConn(q, guildId);
        }
      }
      if (
        newState.status === VoiceConnectionStatus.Signalling &&
        oldState.status === VoiceConnectionStatus.Connecting
      ) {
        global.logError("dc.music.voice.rejoin", {
          message: "Voice WS closed during connect (code " + (newState.closeCode || "n/a") + "): " + (newState.reason || "n/a"),
        });
      }
    });

    conn.on("debug", function () {});

    conn.on("error", function (err) {
      global.logError("dc.music.voice.error", err);
    });

    conn.on("close", function (code) {
      global.logError("dc.music.voice.close", { message: "Close code: " + code });
    });
  };

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const existing = getVoiceConnection(guildId);
    if (existing) {
      try {
        await entersState(existing, VoiceConnectionStatus.Ready, 3000);
        return existing;
      } catch (e) {
        try {
          existing.destroy();
        } catch (err) {}
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    if (connection) {
      connection.destroy();
      await new Promise((r) => setTimeout(r, 3000));
    }

    connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false,
      daveEncryption: true,
      debug: true,
    });
    wire(connection);

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15000);
      return connection;
    } catch (err) {
      lastErr = err;
      if (connection.state.status === "signalling") {
        global.logError("dc.music.voice.stuck", {
          message: "Stuck in Signalling - UDP/IP discovery failing, retrying...",
        });
      }
    }
  }

  connection.destroy();
  throw new Error("Failed to connect to voice channel.");
}

async function recoverConn(queue, guildId) {
  if (queue.recovering) return;
  queue.recovering = true;
  queue.rCnt = 0;

  if (queue.rTimer) clearInterval(queue.rTimer);

  queue.rTimer = setInterval(async () => {
    queue.rCnt++;
    if (queue.rCnt > 5) {
      clearInterval(queue.rTimer);
      queue.recovering = false;
      return;
    }

    try {
      const channel = await queue.textChannel.guild.channels
        .fetch(queue.voiceChannel.id)
        .catch(() => null);
      if (!channel) {
        clearInterval(queue.rTimer);
        queue.recovering = false;
        await clearQ(guildId);
        return;
      }

      queue.connection.destroy();
      try {
        queue.connection = await mkConn(queue.voiceChannel, guildId, () => queue, 2);
      } catch (e) {
        global.logError("dc.music.voice.recovery", e);
        return;
      }

      queue.connection.subscribe(queue.player);

      if (queue.currentSong) {
        const elapsed = queue.currentResource?.playbackDuration
          ? Math.floor(queue.currentResource.playbackDuration / 1000)
          : 0;
        await seekPlay(guildId, elapsed);
      }

      clearInterval(queue.rTimer);
      queue.recovering = false;
    } catch (e) {
      global.logError("dc.music.recovery", e);
    }
  }, 3000);
}

async function seekPlay(guildId, startSeconds) {
  const queue = queues.get(guildId);
  if (!queue || !queue.currentSong) return;

  const filePath = queue.curFp;
  if (!filePath || !fs.existsSync(filePath)) {
    return playNext(guildId);
  }

  try {
    queue.paused = false;
    const resource = createAudioResource(filePath, {
      inlineVolume: true,
      seek: startSeconds || 0,
    });
    resource.volume.setVolume(queue.volume || 1.0);
    queue.player.play(resource);
    queue.currentResource = resource;

    await np(queue, guildId);
  } catch (error) {
    global.logError("dc.music.resume", error);
    playNext(guildId);
  }
}

async function nxtInner(guildId) {
  const queue = queues.get(guildId);
  if (!queue) return;

  if (queue.ckTimer) {
    clearInterval(queue.ckTimer);
    queue.ckTimer = null;
  }
  stopProgressTimer(queue);
  if (queue.collector) {
    try {
      queue.collector.stop();
    } catch (e) {}
    queue.collector = null;
  }
  if (queue.curDir) {
    try {
      await global.scraper.ytdpl.cleanup(queue.curDir);
    } catch (e) {}
    queue.curDir = null;
  }

  if (queue.songs.length === 0 && !queue.nxtFp) {
    await autoFill(queue);

    if (queue.songs.length === 0) {
      try {
        await queue.textChannel.send({
          embeds: [
            new B(queue).ebuilder()
              .setColor("#ED4245")
              .setDescription("Could not find any recommended tracks. Leaving voice channel."),
          ],
        });
      } catch (e) {}
      await clearQ(guildId);
      return;
    }
  }

  let filePath = queue.nxtFp;
  let directory = queue.nxtDir;
  const prevSong = queue.currentSong;

  if (filePath && fs.existsSync(filePath)) {
    queue.currentSong = queue.songs.shift();
    queue.guestMode = !queue.currentSong?.requesterId || !ys.has(queue.currentSong.requesterId);
    queue.curDir = directory;
    queue.curFp = filePath;
    queue.nxtFp = null;
    queue.nxtDir = null;
  } else {
    if (queue.songs.length === 0) {
      await clearQ(guildId);
      return;
    }
    const nextSong = queue.songs.shift();
    queue.currentSong = nextSong;
    queue.guestMode = !queue.currentSong?.requesterId || !ys.has(queue.currentSong.requesterId);
    try {
      const downloader = global.scraper?.ytdpl;

      let file = null;
      try {
        if (downloader) file = await downloader.getCachedFile(nextSong.url);
      } catch (e) {}

      if (!file || !fs.existsSync(file)) {
        const opts = {
          audioOnly: true,
          audioFormat: "opus",
          format: "bestaudio/best",
        };
        let result = null;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            result = await downloadSongFile(nextSong, attempt === 1 ? opts : {});
            if (result && result.files && result.files.length > 0) break;
          } catch (e) {
            if (attempt === 1) {
              await new Promise((r) => setTimeout(r, 2000));
            }
            global.logError("dc.music.download." + attempt, e);
          }
        }
        if (!result || !result.files || result.files.length === 0) {
          throw new Error("Download failed.");
        }
        file = result.files[0];
        queue.curDir = result.directory;
        queue.dlDirs.push(result.directory);
        try {
          if (downloader) await downloader.cacheFile(nextSong.url, file);
        } catch (e) {}
      }

      queue.curFp = file;
      filePath = file;
    } catch (error) {
      global.logError("dc.music.download", error);
      try {
        await queue.textChannel.send(`Skipping unplayable track: **${nextSong.title}**`);
      } catch (e) {}
      return playNext(guildId);
    }
  }

  try {
    if (!fs.existsSync(filePath)) throw new Error("Audio file not found.");

    if (prevSong) {
      queue.previousTracks.push(prevSong);
      if (queue.previousTracks.length > 25) queue.previousTracks.shift();
      if (prevSong.url) {
        queue.history.push(prevSong.url);
        if (queue.history.length > 50) queue.history.shift();
      }
    }

    queue.paused = false;
    const resource = createAudioResource(filePath, { inlineVolume: true });
    resource.volume.setVolume(queue.volume || 1.0);
    queue.player.play(resource);
    queue.currentResource = resource;

    await np(queue, guildId);

    svState(guildId, queue);
    idleChk(queue, guildId);

    queue.ckTimer = setInterval(() => {
      const q = queues.get(guildId);
      if (!q || !q.currentSong || !resource) {
        clearInterval(queue.ckTimer);
        return;
      }
      const elapsed = resource.playbackDuration / 1000;
      const total = q.currentSong.duration;
      if (total <= 20 || total - elapsed <= 20) {
        dlNext(guildId).catch(() => {});
        clearInterval(queue.ckTimer);
        queue.ckTimer = null;
      }
    }, 1000);
  } catch (error) {
    global.logError("dc.music.stream", error);
    playNext(guildId);
  }
}

const nxtBusy = new Set();
const nxtPending = new Set();

async function playNext(guildId) {
  if (nxtBusy.has(guildId)) {
    nxtPending.add(guildId);
    return;
  }
  nxtBusy.add(guildId);
  try {
    await nxtInner(guildId);
  } catch (e) {
    global.logError("dc.music.playnext", e);
  } finally {
    nxtBusy.delete(guildId);
    if (nxtPending.has(guildId)) {
      nxtPending.delete(guildId);
      setTimeout(() => playNext(guildId), 500);
    }
  }
}

async function rstSessions(client) {
  const states = ldAllState();
  for (const [guildId, state] of Object.entries(states)) {
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild || !state.currentSong || !state.textChannelId || !state.voiceChannelId) {
        clrState(guildId);
        continue;
      }
      const textChannel = guild.channels.cache.get(state.textChannelId);
      const voiceChannel = guild.channels.cache.get(state.voiceChannelId);
      if (!textChannel || !voiceChannel || voiceChannel.type !== 2) {
        clrState(guildId);
        continue;
      }

      const connection = await mkConn(
        voiceChannel,
        guildId,
        () => queues.get(guildId),
        2,
      );
      const player = wirePlayer(connection, guildId);

      const queue = {
        voiceChannel,
        textChannel,
        connection,
        player,
        ...createQueueState({
          songs: (state.songs || []).map((s) => ({ ...s })),
          currentSong: { ...state.currentSong },
          volume: state.volume || 1.0,
          loop: state.loop || "off",
          shuffle: state.shuffle || false,
          autoplay: state.autoplay || false,
          autoplayGenre: state.autoplayGenre || null,
          currentFilter: state.filter || "none",
        }),
      };

      queues.set(guildId, queue);

      queue.songs.push(queue.currentSong);
      queue.currentSong = null;
      queue.guestMode = false;
      queue.nxtFp = null;
      queue.nxtDir = null;

      await playNext(guildId);

    } catch (e) {
      global.logError("dc.music.restore", e);
      clrState(guildId);
    }
  }
}

function createPlayerFor(guildId) {
  const player = createAudioPlayer({
    behaviors: { noSubscriber: NoSubscriberBehavior.Play },
  });

  player.on(AudioPlayerStatus.Idle, function () {
    const q = queues.get(guildId);
    if (!q) return;
    if (q.loop === "track" && q.currentSong) {
      seekPlay(guildId, 0);
    } else if (q.loop === "queue" && q.currentSong) {
      q.songs.push({ ...q.currentSong });
      playNext(guildId);
    } else {
      playNext(guildId);
    }
  });

  player.on("error", function (err) {
    global.logError("dc.music.player", err);
    const q = queues.get(guildId);
    if (q) playNext(guildId);
  });

  return player;
}

function createQueueState(overrides = {}) {
  return {
    songs: overrides.songs || [],
    currentSong: overrides.currentSong || null,
    currentResource: null,
    curDir: null,
    curFp: null,
    nxtFp: null,
    nxtDir: null,
    dlNextFlag: false,
    autoBusy: false,
    ckTimer: null,
    idleTimer: null,
    rTimer: null,
    recovering: false,
    rCnt: 0,
    collector: null,
    genreCollector: null,
    progressTimer: null,
    nowPlayingMsg: null,
    history: [],
    previousTracks: [],
    dlDirs: [],
    volume: overrides.volume || 1.0,
    paused: false,
    loop: overrides.loop || "off",
    shuffle: overrides.shuffle || false,
    autoplay: overrides.autoplay || false,
    autoplayGenre: overrides.autoplayGenre || null,
    liked: overrides.liked || new Set(),
    currentFilter: overrides.currentFilter || "none",
    sessionId: Date.now().toString(36) + Math.random().toString(36).substr(2),
  };
}

function wirePlayer(connection, guildId) {
  const player = createPlayerFor(guildId);
  connection.subscribe(player);
  return player;
}

const qLocks = new Map();

async function mkQueue(guildId, voiceChannel, textChannel) {
  const existing = queues.get(guildId);
  if (existing) {
    existing.voiceChannel = voiceChannel;
    existing.textChannel = textChannel;
    return existing;
  }

  const pending = qLocks.get(guildId);
  if (pending) return pending;

  const p = (async () => {
    const connection = await mkConn(voiceChannel, guildId, () => queues.get(guildId));
    const player = wirePlayer(connection, guildId);

    const queue = {
      voiceChannel,
      textChannel,
      connection,
      player,
      emotes: emojis.build(textChannel.guild),
      ...createQueueState(),
    };

    queues.set(guildId, queue);
    return queue;
  })();

  qLocks.set(guildId, p);
  try {
    return await p;
  } finally {
    if (qLocks.get(guildId) === p) qLocks.delete(guildId);
  }
}

module.exports = {
  queues,
  clearQ,
  np,
  seekPlay,
  playNext,
  dlNext,
  mkConn,
  mkQueue,
  onMusicBtn,
  rstSessions,
};
