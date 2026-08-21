const {
  queues,
  clearQ,
  np,
  playNext,
  mkQueue,
  onMusicBtn,
} = require("./engine");
const { formatDuration, isPlaylistUrl } = require("./utils");
const { queued } = require("./embeds");
const emojis = require("./emojis.js");
const { svState } = require("./state");
const ys = require("../../../../scrapers/src/ytsession.js");

async function sesh(uid) {
  try {
    if (ys.has(uid)) return await ys.getSession(uid);
  } catch {}
  return null;
}

function srvEmb(guild, query) {
  const { ebuilder } = guild.client;
  const E = emojis.build(guild);
  const prefix = E.get("search");
  return new ebuilder()
    .setColor("#5865F2")
    .setAuthor({ name: "Searching" })
    .setDescription(
      (prefix ? `${prefix} Searching for ` : "Searching for ") + "`" + query.replace(/`/g, "") + "`..."
    )
    .setFooter({ text: "Hold on, finding the best match..." });
}

function extractVideoId(url) {
  const m = String(url || "").match(/[?&]v=([\w-]{6,})/);
  return m ? m[1] : null;
}

async function resSong(query, downloader, source, session) {
  if (source === "Spotify") {
    const spotify = global.scraper?.spotify;
    if (spotify && /open\.spotify\.com\/track|spotify\.link\//i.test(query)) {
      const track = await spotify.getTrack(query);
      if (track && (track.title || track.name)) {
        try {
          const q = (track.title || track.name) + (track.uploader ? " " + track.uploader : "");
          const hits = await global.scraper.ytmusic.sSongs(q, 1, session);
          const hit = hits && hits[0];
          if (hit && hit.id) {
            return {
              id: hit.id,
              title: hit.title,
              url: hit.url,
              webpage_url: hit.url,
              thumbnail: hit.thumbnail,
              duration: hit.duration,
              uploader: hit.artist,
              channel: hit.artist,
              album: hit.album,
              year: hit.year,
            };
          }
        } catch (e) {
          global.logError("dc.sc.spotify-lookup", e);
        }
      }
      return track;
    }
  }
  if (source === "YouTubeMusic") {
    const songs = await global.scraper.ytmusic.sSongs(query, 1, session);
    if (!songs || songs.length === 0) throw new Error("Track not found on YouTube Music.");
    const hit = songs[0];
    return {
      id: hit.id,
      title: hit.title,
      url: hit.url,
      webpage_url: hit.url,
      thumbnail: hit.thumbnail,
      duration: hit.duration,
      uploader: hit.artist,
      channel: hit.artist,
      album: hit.album,
      year: hit.year,
    };
  }
  const metadata = await downloader.getMetadata(query);
  if (!metadata) throw new Error("Track not found.");
  const info = Array.isArray(metadata) ? metadata[0] : metadata;
  if (!info || !info.id) throw new Error("Invalid track data.");
  return info;
}

async function enqueuePlaylist(url, downloader) {
  const args = [
    "--flat-playlist",
    "-j",
    "--no-warnings",
    "--skip-download",
    "--js-runtimes",
    "node",
    "--remote-components",
    "ejs:github",
    url,
  ];
  const exec = downloader._execute.bind(downloader);
  try {
    const { stdout } = await exec(downloader.ytDlpBin, args, downloader.baseDir);
    const lines = stdout.split("\n").filter((l) => l.trim());
    const songs = [];
    for (const line of lines) {
      try {
        const p = JSON.parse(line);
        if (p && p.id) {
          songs.push({
            title: p.title || "Unknown",
            url: p.webpage_url || `https://www.youtube.com/watch?v=${p.id}`,
            thumbnail: p.thumbnail || "",
            duration: p.duration || 0,
            uploader: p.uploader || p.channel || "Unknown",
            source: "Playlist",
          });
        }
      } catch {}
    }
    return songs;
  } catch {
    return [];
  }
}

async function buildSearchResults(query, session) {
  const ytm = global.scraper?.ytmusic;
  if (!ytm) return [];
  const s = session || null;
  const raw = await ytm.searchType(query, "song", 10, s);
  return raw.map((r) => ({
    id: r.id,
    title: r.title,
    artist: r.artist,
    album: r.album || "",
    duration: r.duration || 0,
    thumbnail: r.thumbnail || "",
    url: r.url,
    type: r.type || "song",
  }));
}

function buildRecommendations(uid) {
  return null;
}

async function playPanel(interaction, opts) {
  const { videoId, playlistId, title, thumbnail } = opts;
  const guild = interaction.guild;
  let member = interaction.member;
  let channel = member?.voice?.channel;
  if (!channel) {
    try {
      member = await guild.members.fetch(interaction.user.id);
      channel = member?.voice?.channel;
    } catch {}
  }
  if (!channel) {
    return {
      error: new (interaction.client.ebuilder)()
        .setColor("#ED4245")
        .setDescription("You must be in a voice channel to play something."),
    };
  }
  const permissions = channel.permissionsFor(guild.members.me);
  if (!permissions || !permissions.has("Connect") || !permissions.has("Speak")) {
    return {
      error: new (interaction.client.ebuilder)()
        .setColor("#ED4245")
        .setDescription("I need **Connect** and **Speak** permissions in the voice channel."),
    };
  }
  const guildId = interaction.guildId;
  let queue = queues.get(guildId);
  if (!queue) {
    queue = await mkQueue(guildId, channel, interaction.channel);
  } else {
    queue.voiceChannel = channel;
    queue.textChannel = interaction.channel;
  }
  if (playlistId) {
    const downloader = global.scraper?.ytdpl;
    const tracks = downloader
      ? await enqueuePlaylist(`https://music.youtube.com/playlist?list=${playlistId}`, downloader)
      : [];
    if (tracks.length === 0) {
      return {
        error: new (interaction.client.ebuilder)()
          .setColor("#ED4245")
          .setDescription("Could not fetch that playlist. Try again later."),
      };
    }
    for (const t of tracks.slice(0, 50)) {
      queue.songs.push({ ...t, requester: `<@${interaction.user.id}>`, requesterId: interaction.user.id });
    }
    if (!queue.currentSong) {
      await np(queue, guildId);
      await playNext(guildId);
    }
    svState(guildId, queue);
    return {
      embed: new (interaction.client.ebuilder)()
        .setColor("#57F287")
        .setTitle("Playlist Added")
        .setDescription(`Added **${tracks.length}** track(s) to the queue.`)
        .setFooter({ text: `Position: #${queue.songs.length}` }),
    };
  }
  const song = {
    id: videoId,
    title: title || "Unknown",
    url: `https://music.youtube.com/watch?v=${videoId}`,
    thumbnail: thumbnail || "",
    duration: 0,
    uploader: "YouTube Music",
    album: "",
    requester: `<@${interaction.user.id}>`,
    requesterId: interaction.user.id,
    source: "YouTubeMusic",
  };
  const isFirst = queue.songs.length === 0 && !queue.currentSong;
  queue.songs.push(song);
  if (!isFirst) {
    const position = queue.songs.length;
    return { embed: queued(queue, song, position, formatDuration) };
  }
  await np(queue, guildId);
  await playNext(guildId);
  svState(guildId, queue);
  return { embed: null };
}

async function handleSearchSelection(interaction, query) {
  const uid = interaction.user.id;
  const session = await sesh(uid);
  let results = [];
  try {
    results = await buildSearchResults(query, session);
  } catch {
    results = [];
  }
  if (!results.length) {
    return interaction.editReply({
      embeds: [
        new (interaction.client.ebuilder)()
          .setColor("#ED4245")
          .setDescription("No results found for `" + query.replace(/`/g, "") + "`"),
      ],
    });
  }
  const options = results.slice(0, 10).map((r, i) => ({
    label: (r.title || "Unknown").slice(0, 80),
    description: `${(r.artist || "Unknown").slice(0, 40)} • ${r.album ? r.album.slice(0, 20) + " • " : ""}${formatDuration(r.duration)}`.slice(0, 90),
    value: r.id,
  }));
  const row = new (interaction.client.abuilder)().addComponents(
    new (interaction.client.mbuilder)()
      .setCustomId("p_select:" + Buffer.from(query).toString("base64").slice(0, 40))
      .setPlaceholder("Choose a song to play")
      .addOptions(options)
  );
  const embed = new (interaction.client.ebuilder)()
    .setColor("#5865F2")
    .setTitle("YouTube Music Search")
    .setDescription(results.map((r, i) => `\`${i + 1}.\` **${r.title}** — ${r.artist} \`${formatDuration(r.duration)}\``).join("\n"))
    .setFooter({ text: "Select a song below • " + query });
  const msg = await interaction.editReply({ embeds: [embed], components: [row] });
  const collector = msg.createMessageComponentCollector({
    filter: (i) => i.customId.startsWith("p_select:") && i.user.id === uid,
    time: 60000,
    max: 1,
  });
  collector.on("collect", async (sel) => {
    const vid = sel.values?.[0];
    const chosen = results.find((r) => r.id === vid);
    if (!chosen) {
      await sel.update({ content: "Selection expired.", embeds: [], components: [] }).catch(() => {});
      return;
    }
    await sel.deferUpdate().catch(() => {});
    const res = await playPanel(sel, {
      videoId: chosen.id,
      title: chosen.title,
      thumbnail: chosen.thumbnail,
    });
    if (res.error) {
      await sel.followUp({ embeds: [res.error], flags: 64 }).catch(() => {});
    } else if (res.embed) {
      await sel.followUp({ embeds: [res.embed] }).catch(() => {});
    }
  });
  collector.on("end", (collected) => {
    if (collected.size === 0) {
      interaction.editReply({ components: [] }).catch(() => {});
    }
  });
}

async function execute(interaction) {
  try {
    await interaction.deferReply();
  } catch {
    return;
  }
  const guild = interaction.guild;
  let member = interaction.member;
  let channel = member?.voice?.channel;
  if (!channel) {
    try {
      member = await guild.members.fetch(interaction.user.id);
      channel = member?.voice?.channel;
    } catch {}
  }
  if (!channel) {
    return interaction.editReply({
      embeds: [
        new (interaction.client.ebuilder)()
          .setColor("#ED4245")
          .setDescription("You must be in a voice channel to use this command."),
      ],
    });
  }
  const permissions = channel.permissionsFor(guild.members.me);
  if (!permissions || !permissions.has("Connect") || !permissions.has("Speak")) {
    return interaction.editReply({
      embeds: [
        new (interaction.client.ebuilder)()
          .setColor("#ED4245")
          .setDescription("I need **Connect** and **Speak** permissions in the voice channel."),
      ],
    });
  }
  const query = (interaction.options.getString("query") || "").trim();
  const guildId = interaction.guildId;
  if (!query) {
    const uid = interaction.user.id;
    const hasSession = ys.has(uid);
    const embed = new (interaction.client.ebuilder)()
      .setColor("#5865F2")
      .setTitle("Music — Discover")
      .setDescription(
        hasSession
          ? "Welcome back — choose what to play:"
          : "Search YouTube Music or explore recommendations:"
      );
    const row = new (interaction.client.abuilder)().addComponents(
      new (interaction.client.bbuilder)()
        .setCustomId("p_rec:charts")
        .setLabel("Charts")
        .setStyle(interaction.client.ButtonStyle.Secondary),
      new (interaction.client.bbuilder)()
        .setCustomId("p_rec:moods")
        .setLabel("Moods")
        .setStyle(interaction.client.ButtonStyle.Secondary),
      new (interaction.client.bbuilder)()
        .setCustomId("p_rec:radio")
        .setLabel("My Radio")
        .setStyle(interaction.client.ButtonStyle.Primary),
      new (interaction.client.bbuilder)()
        .setCustomId("p_rec:library")
        .setLabel("Library")
        .setStyle(interaction.client.ButtonStyle.Secondary)
    );
    const msg = await interaction.editReply({ embeds: [embed], components: [row] });
    const col = msg.createMessageComponentCollector({
      filter: (i) => i.customId.startsWith("p_rec:") && i.user.id === uid,
      time: 60000,
      max: 1,
    });
    col.on("collect", async (btn) => {
      const kind = btn.customId.split(":")[1];
      await btn.deferUpdate().catch(() => {});
      if (kind === "charts") {
        const charts = await ys.charts(10).catch(() => []);
        if (!charts.length) return btn.followUp({ content: "No charts available.", flags: 64 }).catch(() => {});
        const selRow = new (interaction.client.abuilder)().addComponents(
          new (interaction.client.mbuilder)()
            .setCustomId("p_charts_sel")
            .setPlaceholder("Pick a chart playlist")
            .addOptions(charts.slice(0, 10).map((c) => ({ label: c.title.slice(0, 80), value: c.id })))
        );
        const chEmbed = new (interaction.client.ebuilder)()
          .setColor("#5865F2")
          .setTitle("Charts")
          .setDescription(charts.map((c, i) => `\`${i + 1}.\` ${c.title}`).join("\n"));
        const chMsg = await btn.followUp({ embeds: [chEmbed], components: [selRow], flags: 64 }).catch(() => null);
        if (!chMsg) return;
      } else if (kind === "moods") {
        const moods = await ys.moods(10).catch(() => []);
        if (!moods.length) return btn.followUp({ content: "No moods available.", flags: 64 }).catch(() => {});
        const selRow = new (interaction.client.abuilder)().addComponents(
          new (interaction.client.mbuilder)()
            .setCustomId("p_moods_sel")
            .setPlaceholder("Pick a mood")
            .addOptions(moods.slice(0, 10).map((m) => ({ label: m.title.slice(0, 80), value: m.browseId + "|" + (m.params || "") })))
        );
        const mEmbed = new (interaction.client.ebuilder)()
          .setColor("#5865F2")
          .setTitle("Moods & Genres")
          .setDescription(moods.map((m, i) => `\`${i + 1}.\` ${m.title}`).join("\n"));
        await btn.followUp({ embeds: [mEmbed], components: [selRow], flags: 64 }).catch(() => {});
      } else if (kind === "radio") {
        const q = queues.get(guildId);
        const seed = q?.currentSong?.id || q?.currentSong?.url?.match(/[?&]v=([\w-]{6,})/)?.[1];
        if (!seed) return btn.followUp({ content: "Play something first to get your radio.", flags: 64 }).catch(() => {});
        const recs = await ys.radio(uid, seed, 10).catch(() => []);
        if (!recs.length) return btn.followUp({ content: "No recommendations.", flags: 64 }).catch(() => {});
        const selRow = new (interaction.client.abuilder)().addComponents(
          new (interaction.client.mbuilder)()
            .setCustomId("p_radio_sel")
            .setPlaceholder("Pick a recommendation")
            .addOptions(recs.slice(0, 10).map((r) => ({ label: r.title.slice(0, 80), value: r.id })))
        );
        const rEmbed = new (interaction.client.ebuilder)()
          .setColor("#5865F2")
          .setTitle("Recommended for You")
          .setDescription(recs.map((r, i) => `\`${i + 1}.\` ${r.title}`).join("\n"));
        await btn.followUp({ embeds: [rEmbed], components: [selRow], flags: 64 }).catch(() => {});
      } else if (kind === "library") {
        const plists = await ys.plists(uid, 10).catch(() => []);
        if (!plists.length) return btn.followUp({ content: "No playlists — sign in via /account.", flags: 64 }).catch(() => {});
        const selRow = new (interaction.client.abuilder)().addComponents(
          new (interaction.client.mbuilder)()
            .setCustomId("p_lib_sel")
            .setPlaceholder("Pick a playlist")
            .addOptions(plists.slice(0, 10).map((p) => ({ label: p.title.slice(0, 80), value: p.id })))
        );
        const lEmbed = new (interaction.client.ebuilder)()
          .setColor("#5865F2")
          .setTitle("Your Playlists")
          .setDescription(plists.map((p, i) => `\`${i + 1}.\` ${p.title}`).join("\n"));
        await btn.followUp({ embeds: [lEmbed], components: [selRow], flags: 64 }).catch(() => {});
      }
    });
    return;
  }
  try {
    const downloader = global.scraper?.ytdpl;
    if (!downloader) throw new Error("Downloader not available.");
    const isSpotify = /open\.spotify\.com\/(track|album|playlist)|spotify\.link\//i.test(query);
    const isSpotifyPlaylist = isSpotify && /open\.spotify\.com\/(album|playlist)/i.test(query);
    const isSoundCloud = /soundcloud\.com/i.test(query);
    const isDirect = /^https?:\/\/.+\.(mp3|wav|ogg|flac|m4a|aac|opus)(\?|$)/i.test(query);
    const isUrl = /^https?:\/\//i.test(query);
    const isPlaylist = isUrl && isPlaylistUrl(query) && !isSpotify && !isSoundCloud;
    let source;
    if (isSpotify) source = "Spotify";
    else if (isSoundCloud) source = "SoundCloud";
    else if (isDirect) source = "Direct";
    else if (isUrl) source = "URL";
    else source = "YouTubeMusic";
    let queue = queues.get(guildId);
    if (!queue) {
      queue = await mkQueue(guildId, channel, interaction.channel);
    } else {
      queue.voiceChannel = channel;
      queue.textChannel = interaction.channel;
    }
    if (isSpotifyPlaylist) {
      const spotify = global.scraper?.spotify;
      let tracks = [];
      if (spotify) {
        try {
          tracks = (await spotify.getPlaylist(query)).slice(0, 50);
        } catch {}
      }
      if (tracks.length === 0) {
        return interaction.editReply({
          embeds: [
            new (interaction.client.ebuilder)()
              .setColor("#ED4245")
              .setDescription("Could not fetch Spotify album/playlist. Try a track URL or a title search."),
          ],
        });
      }
      for (const t of tracks) {
        queue.songs.push({ ...t, requester: `<@${interaction.user.id}>`, requesterId: interaction.user.id, source: "Spotify" });
      }
      await interaction.editReply({
        embeds: [
          new (interaction.client.ebuilder)()
            .setColor("#57F287")
            .setTitle("Spotify Playlist Added")
            .setDescription(`Added **${tracks.length}** track(s) from **${tracks[0].uploader || "Spotify"}**.`)
            .setThumbnail(tracks[0].thumbnail || null)
            .setFooter({ text: `Position: #${queue.songs.length}` }),
        ],
      });
      if (!queue.currentSong) {
        await np(queue, guildId);
        await playNext(guildId);
      }
      svState(guildId, queue);
      return;
    }
    if (isPlaylist) {
      const tracks = await enqueuePlaylist(query, downloader);
      if (tracks.length === 0) {
        const info = await resSong(query, downloader, "URL", await sesh(interaction.user.id));
        const song = {
          title: info.title || "Unknown",
          url: info.webpage_url || info.url || info.original_url,
          thumbnail: info.thumbnail || "",
          duration: info.duration || 0,
          uploader: info.uploader || info.channel || "Unknown",
          album: info.album || "",
          requester: `<@${interaction.user.id}>`,
          requesterId: interaction.user.id,
          source: "URL",
        };
        queue.songs.push(song);
        await interaction.editReply({
          embeds: [
            new (interaction.client.ebuilder)()
              .setColor("#5865F2")
              .setTitle("Added to Queue")
              .setDescription(`[${song.title}](${song.url})`)
              .setThumbnail(song.thumbnail || null)
              .addFields(
                { name: "Duration", value: `\`[${formatDuration(song.duration)}]\``, inline: true },
                { name: "Source", value: `\`${song.source}\``, inline: true },
                { name: "Position", value: `\`#${queue.songs.length}\``, inline: true }
              ),
          ],
        });
      } else {
        for (const t of tracks.slice(0, 50)) {
          queue.songs.push({ ...t, requester: `<@${interaction.user.id}>`, requesterId: interaction.user.id });
        }
        await interaction.editReply({
          embeds: [
            new (interaction.client.ebuilder)()
              .setColor("#57F287")
              .setTitle("Playlist Added")
              .setDescription(`Added **${Math.min(tracks.length, 50)}** track(s) from playlist.`)
              .setFooter({ text: `Position: #${queue.songs.length}` }),
          ],
        });
      }
      if (!queue.currentSong) {
        await np(queue, guildId);
        await playNext(guildId);
      }
      return;
    }
    if (source === "YouTubeMusic" && !isUrl) {
      await interaction.editReply({ embeds: [srvEmb(interaction.guild, query)] });
      const session = await sesh(interaction.user.id);
      return handleSearchSelection(interaction, query);
    }
    await interaction.editReply({ embeds: [srvEmb(interaction.guild, query)] });
    const info = await resSong(query, downloader, source, await sesh(interaction.user.id));
    const song = {
      title: info.title || "Unknown",
      url: info.webpage_url || info.url || info.original_url,
      thumbnail: info.thumbnail || "",
      duration: info.duration || 0,
      uploader: info.uploader || info.channel || "Unknown",
      album: info.album || "",
      requester: `<@${interaction.user.id}>`,
      requesterId: interaction.user.id,
      source: source,
    };
    const isFirst = queue.songs.length === 0 && !queue.currentSong;
    queue.songs.push(song);
    if (!isFirst) {
      const position = queue.songs.length;
      const embed = queued(queue, song, position, formatDuration);
      await interaction.editReply({ embeds: [embed] });
      return;
    }
    await interaction.editReply({ embeds: [srvEmb(interaction.guild, query)] });
    const E = emojis.build(interaction.guild);
    const searchIcon = E.get("search");
    const cleanQuery = query.replace(/`/g, "");
    const downloadStart = Date.now();
    const poll = setInterval(async () => {
      try {
        const ticks = ["...", "..", ".", "..", ".."];
        const dot = ticks[Math.floor((Date.now() - downloadStart) / 1750) % ticks.length];
        await interaction.editReply({
          embeds: [
            new (interaction.client.ebuilder)()
              .setColor("#5865F2")
              .setAuthor({ name: "Searching" })
              .setDescription(
                (searchIcon ? `${searchIcon} Searching for ` : "Searching for ") + "`" + cleanQuery + "`" + dot
              ),
          ],
        });
      } catch {}
    }, 1750);
    try {
      await playNext(guildId);
    } finally {
      clearInterval(poll);
    }
    svState(guildId, queue);
  } catch (error) {
    global.logError("dc.music.play", error);
    try {
      await interaction.editReply({
        embeds: [new (interaction.client.ebuilder)().setColor("#ED4245").setDescription(`Error: ${error.message}`)],
      });
    } catch {}
  }
}

const { define } = require("../../../plugin");

module.exports = define({
  name: ["p"],
  category: "music",
  description: "Play music from YouTube, YouTube Music, Spotify, SoundCloud, or any supported URL",
  options: [
    {
      name: "query",
      type: 3,
      description: "Song title, playlist URL, Spotify URL, or direct audio link (empty for recommendations)",
      required: false,
      autocomplete: true,
    },
  ],
  getQueues() {
    return queues;
  },
  async handleButton(interaction) {
    const id = String(interaction.customId || "");
    if (id === "music_dashboard" || id.startsWith("music_dash_")) {
      const queue = queues.get(interaction.guildId);
      const fakeQ = queue || { textChannel: interaction.channel, client: interaction.client, songs: [], currentSong: null, volume: 1, loop: "off", autoplay: false };
      await onMusicBtn(fakeQ, interaction.guildId, interaction, interaction.message);
      return;
    }
    const queue = queues.get(interaction.guildId);
    if (!queue) {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({ content: "No music is currently playing.", flags: 64 });
      }
      return;
    }
    await onMusicBtn(queue, interaction.guildId, interaction, interaction.message);
  },
  playPanel,
  run: async (ctx) => execute(ctx.interaction),
});
