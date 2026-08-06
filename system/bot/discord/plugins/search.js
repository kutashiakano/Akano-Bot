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
  ButtonStyle
} = require("discord.js");
const fs = require("fs");

const searchResults = new Map();

function formatDuration(seconds) {
  if (!seconds || seconds === 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

module.exports = {
  name: "search",
  description: "Search for music on YouTube and pick a result to play",
  options: [
    {
      name: "query",
      type: 3,
      description: "Song title or search query",
      required: true
    }
  ],

  async execute(interaction) {
    try { await interaction.deferReply(); } catch (e) { return; }

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

    const query = interaction.options.getString("query");
    const userId = interaction.user.id;

    try {
      const downloader = global.scraper?.ytdpl;
      if (!downloader) throw new Error("Downloader not available.");

      let results;
      if (typeof downloader.search === "function") {
        results = await downloader.search(query, { limit: 9 });
      } else {
        results = await downloader.getMetadata("ytsearch9:" + query);
      }

      if (!results || !Array.isArray(results) || results.length === 0) {
        throw new Error("No results found.");
      }

      const tracks = results.slice(0, 9);

      for (const track of tracks) {
        if (!track.duration && track.url) {
          try {
            const meta = await downloader.getMetadata(track.url);
            const info = Array.isArray(meta) ? meta[0] : meta;
            if (info && info.duration) {
              track.duration = info.duration;
            }
          } catch (e) {}
        }
      }

      if (searchResults.has(userId)) {
        const prev = searchResults.get(userId);
        if (prev.timeout) clearTimeout(prev.timeout);
      }

      const timeout = setTimeout(() => searchResults.delete(userId), 5 * 60 * 1000);
      searchResults.set(userId, { results: tracks, timeout });

      const description = tracks.map((track, i) => {
        return `\`${i + 1}.\` **${track.title || "Unknown"}** — ${track.uploader || track.channel || "Unknown"} \`${formatDuration(track.duration)}\``;
      }).join("\n");

      const embed = new EmbedBuilder()
        .setColor("#5865F2")
        .setTitle("Search Results")
        .setDescription(`**Query:** ${query}\n\n${description}`)
        .setFooter({ text: "Select a track to play • Expires in 5 minutes" });

      const row1 = new ActionRowBuilder();
      for (let i = 0; i < Math.min(4, tracks.length); i++) {
        row1.addComponents(
          new ButtonBuilder()
            .setCustomId(`search_select_${i}`)
            .setLabel(`${i + 1}`)
            .setStyle(ButtonStyle.Primary)
        );
      }
      row1.addComponents(
        new ButtonBuilder()
          .setCustomId("search_cancel")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      );

      const row2 = new ActionRowBuilder();
      for (let i = 4; i < Math.min(9, tracks.length); i++) {
        row2.addComponents(
          new ButtonBuilder()
            .setCustomId(`search_select_${i}`)
            .setLabel(`${i + 1}`)
            .setStyle(ButtonStyle.Primary)
        );
      }

      const components = tracks.length > 4 ? [row1, row2] : [row1];

      const reply = await interaction.editReply({
        embeds: [embed],
        components: components
      });

      const collector = reply.createMessageComponentCollector({
        component: (c) => c.isButton(),
        time: 5 * 60 * 1000,
        max: 1
      });

      collector.on("collect", async (btn) => {
        if (btn.user.id !== userId) {
          await btn.reply({ content: "This isn't your search.", flags: 64 }).catch(() => {});
          return;
        }

        if (btn.customId === "search_cancel") {
          const data = searchResults.get(userId);
          if (data && data.timeout) clearTimeout(data.timeout);
          searchResults.delete(userId);
          await btn.update({
            embeds: [new EmbedBuilder().setColor("#ED4245").setDescription("Search cancelled.")],
            components: []
          });
          return;
        }

        await btn.deferUpdate().catch(() => {});

        const index = parseInt(btn.customId.replace("search_select_", ""));
        const data = searchResults.get(userId);
        if (!data || !data.results[index]) {
          await btn.followUp({ content: "Invalid selection.", flags: 64 }).catch(() => {});
          return;
        }

        const track = data.results[index];
        if (data.timeout) clearTimeout(data.timeout);
        searchResults.delete(userId);

        let member = btn.member;
        let channel = member?.voice?.channel;
        if (!channel) {
          try {
            member = await btn.guild.members.fetch(userId);
            channel = member?.voice?.channel;
          } catch (err) {}
        }

        if (!channel) {
          await btn.followUp({
            embeds: [new EmbedBuilder().setColor("#ED4245").setDescription("You must be in a voice channel.")],
            flags: 64
          }).catch(() => {});
          return;
        }

        const song = {
          title: track.title || "Unknown",
          url: track.webpage_url || track.url || track.original_url,
          thumbnail: track.thumbnail || "",
          duration: track.duration || 0,
          uploader: track.uploader || track.channel || "Unknown",
          requester: `<@${userId}>`,
          source: "YouTube"
        };

        const playCmd = global.discordCommands["p"];
        const queues = playCmd?.getQueues?.();
        const guildId = btn.guildId;
        let queue = queues?.get(guildId);

        if (!queue) {
          const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: false,
            daveEncryption: false
          });

          connection.on("stateChange", function (oldState, newState) {
            if (newState.status === VoiceConnectionStatus.Disconnected) {
              if (!queue.recovering) {
                startConnectionRecovery(queue, guildId);
              }
            }
          });

          try {
            await entersState(connection, VoiceConnectionStatus.Ready, 15000);
          } catch (err) {
            connection.destroy();
            await btn.followUp({
              embeds: [new EmbedBuilder().setColor("#ED4245").setDescription("Failed to connect to voice channel.")],
              flags: 64
            }).catch(() => {});
            return;
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
            console.error("[Search:Play] Player error:", err.message);
            playNext(guildId);
          });

          queue = {
            voiceChannel: channel,
            textChannel: btn.channel,
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
            downloadedDirs: [],
            volume: 1.0,
            paused: false,
            loop: "off",
            shuffle: false,
            autoplay: false,
            autoplayGenre: null,
            sessionId: Date.now().toString(36) + Math.random().toString(36).substr(2)
          };

          queues.set(guildId, queue);
        } else {
          queue.voiceChannel = channel;
          queue.textChannel = btn.channel;
        }

        const isFirst = queue.songs.length === 0 && !queue.currentSong;
        queue.songs.push(song);

        if (!isFirst) {
          const position = queue.songs.length;
          await btn.followUp({
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
            ],
            flags: 64
          }).catch(() => {});
          return;
        }

        await btn.followUp({
          embeds: [new EmbedBuilder().setColor("#57F287").setDescription(`Loading: **${song.title}**...`)],
          flags: 64
        }).catch(() => {});

        const nextSong = queue.songs.shift();
        queue.currentSong = nextSong;

        const downloader = global.scraper?.ytdpl;
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

        const elapsed = 0;
        const progress = buildProgressBar(elapsed, song.duration);

        const nowPlayingEmbed = new EmbedBuilder()
          .setColor("#5865F2")
          .setAuthor({ name: "Now Playing" })
          .setTitle(song.title)
          .setURL(song.url)
          .setThumbnail(song.thumbnail || null)
          .setDescription(`\`${formatDuration(elapsed)}\` ${progress} \`${formatDuration(song.duration)}\``)
          .addFields(
            { name: "Artist", value: song.uploader, inline: true },
            { name: "Requested by", value: song.requester, inline: true }
          )
          .setFooter({ text: `Session: ${queue.sessionId.slice(0, 6)}` });

        queue.textChannel.send({ embeds: [nowPlayingEmbed] }).catch(() => {});

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
      });

      collector.on("end", (collected) => {
        const data = searchResults.get(userId);
        if (data && data.timeout) clearTimeout(data.timeout);
        searchResults.delete(userId);

        if (collected.size === 0) {
          interaction.editReply({
            embeds: [new EmbedBuilder().setColor("#ED4245").setDescription("Search timed out.")],
            components: []
          }).catch(() => {});
        } else {
          interaction.editReply({ components: [] }).catch(() => {});
        }
      });
    } catch (error) {
      console.error("[Search] Error:", error);
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

function buildProgressBar(current, total, length = 14) {
  if (!total || total === 0) return "—".repeat(length);
  const progress = Math.min(Math.floor((current / total) * length), length - 1);
  return "═".repeat(progress) + "●" + "═".repeat(length - progress - 1);
}

async function cleanupQueue(guildId) {
  const playCmd = global.discordCommands["p"];
  const queues = playCmd?.getQueues?.();
  const queue = queues?.get(guildId);
  if (!queue) return;
  queues.delete(guildId);
  if (queue.checkInterval) clearInterval(queue.checkInterval);
  if (queue.idleTimer) clearTimeout(queue.idleTimer);
  if (queue.recoveryInterval) clearInterval(queue.recoveryInterval);
  if (queue.collector) try { queue.collector.stop(); } catch (e) {}
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

function startInactivityCheck(queue, guildId) {
  if (queue.idleTimer) clearTimeout(queue.idleTimer);
  queue.idleTimer = setTimeout(async () => {
    const playCmd = global.discordCommands["p"];
    const queues = playCmd?.getQueues?.();
    const q = queues?.get(guildId);
    if (!q) return;
    const ch = q.voiceChannel;
    if (!ch) {
      await cleanupQueue(guildId);
      return;
    }
    try {
      const fetched = await q.textChannel.guild.channels.fetch(ch.id);
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
      console.error("[Search:Play] Recovery attempt failed:", e.message);
    }
  }, 3000);
}

async function preDownloadNext(guildId) {
  const playCmd = global.discordCommands["p"];
  const queues = playCmd?.getQueues?.();
  const queue = queues?.get(guildId);
  if (!queue || queue.isDownloadingNext || queue.nextFilePath) return;

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
    console.error("[Search:Play] Pre-download error:", e.message);
  } finally {
    queue.isDownloadingNext = false;
  }
}

async function playFromPosition(guildId, startSeconds) {
  const playCmd = global.discordCommands["p"];
  const queues = playCmd?.getQueues?.();
  const queue = queues?.get(guildId);
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
  } catch (error) {
    console.error("[Search:Play] Resume error:", error.message);
    playNext(guildId);
  }
}

async function playNext(guildId) {
  const playCmd = global.discordCommands["p"];
  const queues = playCmd?.getQueues?.();
  const queue = queues?.get(guildId);
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
    if (queue.songs.length === 0) {
      try {
        await queue.textChannel.send({
          embeds: [
            new EmbedBuilder()
              .setColor("#ED4245")
              .setDescription("Queue is empty. Leaving voice channel.")
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
      console.error("[Search:Play] Download error:", error.message);
      try {
        await queue.textChannel.send(`Skipping unplayable track: **${nextSong.title}**`);
      } catch (e) {}
      return playNext(guildId);
    }
  }

  try {
    if (!fs.existsSync(filePath)) throw new Error("Audio file not found.");

    if (queue.currentSong) {
      queue.history.push(queue.currentSong.url);
      if (queue.history.length > 50) queue.history.shift();
    }

    queue.paused = false;
    const resource = createAudioResource(filePath, { inlineVolume: true });
    resource.volume.setVolume(queue.volume || 1.0);
    queue.player.play(resource);
    queue.currentResource = resource;

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
    console.error("[Search:Play] Stream setup error:", error.message);
    playNext(guildId);
  }
}
