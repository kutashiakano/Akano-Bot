const {queues: queues, playNext: playNext} = require("./engine");
const {formatDuration: formatDuration} = require("./utils");
const emojis = require("./emojis.js");
const ys = require("../../../../scrapers/src/ytsession.js");
const {svState: svState} = require("./state");

async function sesh(uid) {
  try {
    if (ys.has(uid)) return await ys.getSession(uid);
  } catch {}
  return null;
}

function dashboardEmbed(guild, queue, hasSession) {
  const {ebuilder: ebuilder} = guild.client;
  const E = emojis.build(guild);
  const now = queue?.currentSong;
  const title = now ? now.title : "No track playing";
  const artist = now ? now.uploader || now.channel || "Unknown" : "Use Search or Play to start";
  const embed = (new ebuilder).setColor("#5865F2").setTitle("Music Dashboard").setThumbnail(now?.thumbnail || null);
  if (now) {
    embed.setDescription(`**Now Playing**\n[${title}](${now.url}) — ${artist} \`${formatDuration(now.duration)}\``);
    embed.addFields({
      name: "Queue",
      value: `\`${queue.songs.length} track(s)\``,
      inline: true
    }, {
      name: "Volume",
      value: `\`${Math.round((queue.volume || 1) * 100)}%\``,
      inline: true
    }, {
      name: "Loop",
      value: `\`${queue.loop}\``,
      inline: true
    });
  } else {
    embed.setDescription(hasSession ? "Signed in to YouTube Music — explore your library, playlists, or search." : "Search YouTube Music or sign in via /account to unlock your library.");
  }
  embed.setFooter({
    text: hasSession ? "Signed in • Pick an action below" : "Guest • /account to sign in"
  });
  return embed;
}

function dashboardComponents(guild) {
  const {abuilder: abuilder, mbuilder: mbuilder} = guild.client;
  const select = (new mbuilder).setCustomId("music_dash_sel").setPlaceholder("Choose an action").addOptions({
    label: "Search",
    value: "search",
    description: "Search YouTube Music",
    emoji: "🔍"
  }, {
    label: "Recommendations",
    value: "recs",
    description: "Charts, moods & radio"
  }, {
    label: "My Playlists",
    value: "playlists",
    description: "Browse your playlists"
  }, {
    label: "Liked Songs",
    value: "liked",
    description: "Your liked songs"
  }, {
    label: "Queue",
    value: "queue",
    description: "View current queue"
  }, {
    label: "Account",
    value: "account",
    description: "Manage YouTube Music account"
  });
  const row = (new abuilder).addComponents(select);
  return [ row ];
}

async function handleSearch(interaction) {
  const modal = (new interaction.client.modal).setCustomId("music_search_modal").setTitle("Search YouTube Music");
  const input = (new interaction.client.textInput).setCustomId("music_search_q").setLabel("Song, artist or album").setStyle(interaction.client.TextInputStyle.Short).setPlaceholder("e.g. YOASOBI - Idol").setRequired(true).setMaxLength(100);
  modal.addComponents((new interaction.client.abuilder).addComponents(input));
  await interaction.showModal(modal).catch(() => {});
  let submitted;
  try {
    submitted = await interaction.awaitModalSubmit({
      filter: m => m.customId === "music_search_modal" && m.user.id === interaction.user.id,
      time: 6e4
    });
  } catch {
    return;
  }
  const q = submitted.fields.getTextInputValue("music_search_q").trim();
  if (!q) {
    await submitted.reply({
      content: "Empty query.",
      flags: 64
    }).catch(() => {});
    return;
  }
  await submitted.deferReply({
    flags: 64
  }).catch(() => {});
  const session = await sesh(interaction.user.id);
  const ytm = global.scraper?.ytmusic;
  const results = await ytm.searchType(q, "song", 10, session).catch(() => []);
  if (!results.length) {
    await submitted.editReply({
      content: "No results for `" + q.replace(/`/g, "") + "`"
    }).catch(() => {});
    return;
  }
  const opts = results.slice(0, 10).map(r => ({
    label: (r.title || "Unknown").slice(0, 80),
    description: `${(r.artist || "Unknown").slice(0, 40)} • ${formatDuration(r.duration)}`.slice(0, 90),
    value: r.id
  }));
  const row = (new submitted.client.abuilder).addComponents((new submitted.client.mbuilder).setCustomId("music_search_pick").setPlaceholder("Choose a song").addOptions(opts));
  const embed = (new submitted.client.ebuilder).setColor("#5865F2").setTitle("Results for " + q).setDescription(results.map((r, i) => `\`${i + 1}.\` **${r.title}** — ${r.artist} \`${formatDuration(r.duration)}\``).join("\n"));
  const msg = await submitted.editReply({
    embeds: [ embed ],
    components: [ row ]
  }).catch(() => null);
  if (!msg) return;
  const col = msg.createMessageComponentCollector({
    filter: i => i.customId === "music_search_pick" && i.user.id === interaction.user.id,
    time: 6e4,
    max: 1
  });
  col.on("collect", async sel => {
    const vid = sel.values?.[0];
    const chosen = results.find(r => r.id === vid);
    if (!chosen) return sel.update({
      content: "Expired.",
      embeds: [],
      components: []
    }).catch(() => {});
    await sel.deferUpdate().catch(() => {});
    const play = require("./play.js");
    const res = await play.playPanel(sel, {
      videoId: chosen.id,
      title: chosen.title,
      thumbnail: chosen.thumbnail
    });
    if (res.error) await sel.followUp({
      embeds: [ res.error ],
      flags: 64
    }).catch(() => {}); else if (res.embed) await sel.followUp({
      embeds: [ res.embed ]
    }).catch(() => {});
  });
}

async function handleRecs(interaction) {
  const row = (new interaction.client.abuilder).addComponents((new interaction.client.bbuilder).setCustomId("music_recs_charts").setLabel("Charts").setStyle(interaction.client.ButtonStyle.Secondary), (new interaction.client.bbuilder).setCustomId("music_recs_moods").setLabel("Moods").setStyle(interaction.client.ButtonStyle.Secondary), (new interaction.client.bbuilder).setCustomId("music_recs_radio").setLabel("Radio").setStyle(interaction.client.ButtonStyle.Primary));
  const embed = (new interaction.client.ebuilder).setColor("#5865F2").setTitle("Recommendations").setDescription("Pick a source:");
  await interaction.reply({
    embeds: [ embed ],
    components: [ row ],
    flags: 64
  }).catch(() => {});
}

async function handlePlaylists(interaction) {
  const uid = interaction.user.id;
  if (!ys.has(uid)) {
    await interaction.reply({
      content: "Sign in via /account first to see your playlists.",
      flags: 64
    }).catch(() => {});
    return;
  }
  const plists = await ys.plists(uid, 25).catch(() => []);
  const row = (new interaction.client.abuilder).addComponents((new interaction.client.mbuilder).setCustomId("music_pl_pick").setPlaceholder("Choose a playlist").addOptions((plists.length ? plists : [ {
    title: "No playlists",
    id: "none"
  } ]).slice(0, 25).map(p => ({
    label: p.title.slice(0, 80),
    value: p.id
  }))));
  const btnRow = (new interaction.client.abuilder).addComponents((new interaction.client.bbuilder).setCustomId("music_pl_create").setLabel("Create Playlist").setStyle(interaction.client.ButtonStyle.Success));
  const embed = (new interaction.client.ebuilder).setColor("#5865F2").setTitle("Your Playlists").setDescription(plists.length ? plists.map((p, i) => `\`${i + 1}.\` ${p.title}`).join("\n").slice(0, 3800) : "No playlists yet — create one!");
  const comps = plists.length ? [ row, btnRow ] : [ btnRow ];
  const msg = await interaction.reply({
    embeds: [ embed ],
    components: comps,
    flags: 64
  }).catch(() => null);
  if (!msg) return;
  const fetched = await interaction.fetchReply().catch(() => msg);
  const col = fetched.createMessageComponentCollector({
    filter: i => (i.customId === "music_pl_pick" || i.customId === "music_pl_create") && i.user.id === uid,
    time: 6e4
  });
  col.on("collect", async sel => {
    if (sel.customId === "music_pl_create") {
      const modal = (new sel.client.modal).setCustomId("music_pl_create_modal").setTitle("Create Playlist");
      const input = (new sel.client.textInput).setCustomId("music_pl_name").setLabel("Playlist name").setStyle(sel.client.TextInputStyle.Short).setPlaceholder("My favorites").setRequired(true).setMaxLength(60);
      modal.addComponents((new sel.client.abuilder).addComponents(input));
      await sel.showModal(modal).catch(() => {});
      try {
        const sub = await sel.awaitModalSubmit({
          filter: m => m.customId === "music_pl_create_modal" && m.user.id === uid,
          time: 6e4
        });
        const name = sub.fields.getTextInputValue("music_pl_name").trim();
        if (!name) return sub.reply({
          content: "Empty name.",
          flags: 64
        }).catch(() => {});
        await sub.deferReply({
          flags: 64
        }).catch(() => {});
        const res = await ys.newPl(uid, name).catch(() => ({
          ok: false
        }));
        if (res.ok) await sub.editReply({
          content: `Playlist **${name}** created!`
        }).catch(() => {}); else await sub.editReply({
          content: `⚠️ ${res.message || "Cannot create playlist with TV login — use YouTube app, then /music to see it."}`
        }).catch(() => {});
      } catch {}
      return;
    }
    const pid = sel.values?.[0];
    if (!pid || pid === "none") return;
    const tracks = await ys.plist(uid, pid, 25).catch(() => []);
    const tRow = (new sel.client.abuilder).addComponents((new sel.client.bbuilder).setCustomId("music_pl_play:" + pid).setLabel("Play").setStyle(sel.client.ButtonStyle.Success), (new sel.client.bbuilder).setCustomId("music_pl_queue:" + pid).setLabel("Queue").setStyle(sel.client.ButtonStyle.Secondary), (new sel.client.bbuilder).setCustomId("music_pl_addcur:" + pid).setLabel("Add Current").setStyle(sel.client.ButtonStyle.Primary));
    const tEmbed = (new sel.client.ebuilder).setColor("#5865F2").setTitle("Playlist • " + (plists.find(p => p.id === pid)?.title || pid)).setDescription(tracks.length ? tracks.slice(0, 10).map((t, i) => `\`${i + 1}.\` ${t.title}`).join("\n") : "Empty playlist.");
    await sel.update({
      embeds: [ tEmbed ],
      components: [ tRow ]
    }).catch(() => {});
  });
}

async function handleLiked(interaction) {
  const uid = interaction.user.id;
  if (!ys.has(uid)) {
    await interaction.reply({
      content: "Sign in via /account first.",
      flags: 64
    }).catch(() => {});
    return;
  }
  const liked = await ys.likes(uid, 25).catch(() => []);
  if (!liked.length) {
    await interaction.reply({
      content: "No liked songs yet.",
      flags: 64
    }).catch(() => {});
    return;
  }
  const row = (new interaction.client.abuilder).addComponents((new interaction.client.mbuilder).setCustomId("music_liked_pick").setPlaceholder("Pick a liked song to play").addOptions(liked.slice(0, 25).map(s => ({
    label: s.title.slice(0, 80),
    value: s.id
  }))));
  const embed = (new interaction.client.ebuilder).setColor("#5865F2").setTitle("Liked Songs").setDescription(liked.map((s, i) => `\`${i + 1}.\` ${s.title}`).join("\n").slice(0, 3800));
  const msg = await interaction.reply({
    embeds: [ embed ],
    components: [ row ],
    flags: 64
  }).catch(() => null);
  if (!msg) return;
  const fetched = await interaction.fetchReply().catch(() => msg);
  const col = fetched.createMessageComponentCollector({
    filter: i => i.customId === "music_liked_pick" && i.user.id === uid,
    time: 6e4,
    max: 1
  });
  col.on("collect", async sel => {
    const vid = sel.values?.[0];
    const item = liked.find(s => s.id === vid);
    if (!item) return sel.update({
      content: "Expired.",
      embeds: [],
      components: []
    }).catch(() => {});
    await sel.deferUpdate().catch(() => {});
    const play = require("./play.js");
    const res = await play.playPanel(sel, {
      videoId: vid,
      title: item.title
    });
    if (res.error) await sel.followUp({
      embeds: [ res.error ],
      flags: 64
    }).catch(() => {}); else if (res.embed) await sel.followUp({
      embeds: [ res.embed ]
    }).catch(() => {});
  });
}

async function handleQueue(interaction) {
  const q = queues.get(interaction.guildId);
  if (!q || !q.currentSong && q.songs.length === 0) {
    await interaction.reply({
      content: "Queue is empty.",
      flags: 64
    }).catch(() => {});
    return;
  }
  const now = q.currentSong ? `**Now:** [${q.currentSong.title}](${q.currentSong.url}) — ${q.currentSong.uploader || "?"}\n\n` : "";
  const list = q.songs.slice(0, 10).map((s, i) => `\`${i + 1}.\` ${s.title} \`[${formatDuration(s.duration)}]\``).join("\n") || "*No queued tracks*";
  const embed = (new interaction.client.ebuilder).setColor("#5865F2").setTitle("Queue").setDescription(now + list).setFooter({
    text: `${q.songs.length} in queue • ${q.loop} • ${q.shuffle ? "shuffle on" : "shuffle off"}`
  });
  await interaction.reply({
    embeds: [ embed ],
    flags: 64
  }).catch(() => {});
}

async function execute(interaction) {
  const hasSession = ys.has(interaction.user.id);
  const queue = queues.get(interaction.guildId);
  const embed = dashboardEmbed(interaction.guild, queue, hasSession);
  const rows = dashboardComponents(interaction.guild);
  const msg = await interaction.reply({
    embeds: [ embed ],
    components: rows,
    flags: 64
  }).catch(() => null);
  if (!msg) return;
  const fetched = await interaction.fetchReply().catch(() => msg);
  const col = fetched.createMessageComponentCollector({
    filter: i => i.customId === "music_dash_sel" && i.user.id === interaction.user.id,
    time: 12e4,
    max: 10
  });
  col.on("collect", async sel => {
    const v = sel.values?.[0];
    if (v === "search") {
      await handleSearch(sel).catch(() => {});
    } else if (v === "recs") {
      await sel.deferUpdate().catch(() => {});
      await handleRecs(sel).catch(() => {});
    } else if (v === "playlists") {
      await sel.deferUpdate().catch(() => {});
      await handlePlaylists(sel).catch(() => {});
    } else if (v === "liked") {
      await sel.deferUpdate().catch(() => {});
      await handleLiked(sel).catch(() => {});
    } else if (v === "queue") {
      await handleQueue(sel).catch(() => {});
    } else if (v === "account") {
      await sel.deferUpdate().catch(() => {});
      const acc = require("../tools/account.js");
      const fake = Object.create(sel);
      fake.deferReply = sel.deferReply.bind(sel);
      fake.editReply = sel.editReply.bind(sel);
      fake.reply = sel.followUp.bind(sel);
      await acc.execute(sel).catch(() => {});
    }
  });
  col.on("end", () => {
    fetched.edit({
      components: []
    }).catch(() => {});
  });
  const btnCol = fetched.createMessageComponentCollector({
    filter: i => /^music_(pl_|liked_|recs_|search_|dash_)/.test(i.customId) && i.user.id === interaction.user.id,
    time: 12e4
  });
  btnCol.on("collect", async btn => {
    const id = btn.customId;
    if (id.startsWith("music_pl_play:")) {
      const pid = id.split(":")[1];
      await btn.deferUpdate().catch(() => {});
      const play = require("./play.js");
      const res = await play.playPanel(btn, {
        playlistId: pid
      });
      if (res.error) await btn.followUp({
        embeds: [ res.error ],
        flags: 64
      }).catch(() => {}); else if (res.embed) await btn.followUp({
        embeds: [ res.embed ]
      }).catch(() => {});
    } else if (id.startsWith("music_pl_addcur:")) {
      const pid = id.split(":")[1];
      const q = queues.get(btn.guildId);
      const cur = q?.currentSong;
      if (!cur || !cur.id) return btn.reply({
        content: "No song playing to add.",
        flags: 64
      }).catch(() => {});
      const vid = cur.id || String(cur.url || "").match(/[?&]v=([\w-]{6,})/)?.[1];
      if (!vid) return btn.reply({
        content: "Current track has no video id.",
        flags: 64
      }).catch(() => {});
      const ok = await ys.addPl(btn.user.id, pid, vid).catch(() => false);
      await btn.reply({
        content: ok ? `Added **${cur.title}** to playlist.` : "Failed to add — try again or check YouTube Music.",
        flags: 64
      }).catch(() => {});
    } else if (id.startsWith("music_pl_queue:")) {
      const pid = id.split(":")[1];
      const tracks = await ys.plist(btn.user.id, pid, 25).catch(() => []);
      if (!tracks.length) return btn.reply({
        content: "Empty.",
        flags: 64
      }).catch(() => {});
      let q = queues.get(btn.guildId);
      if (!q) {
        const vc = btn.member?.voice?.channel;
        if (!vc) return btn.reply({
          content: "Join a voice channel.",
          flags: 64
        }).catch(() => {});
        q = await require("./engine").mkQueue(btn.guildId, vc, btn.channel);
      }
      for (const t of tracks) q.songs.push({
        id: t.id,
        title: t.title,
        url: `https://music.youtube.com/watch?v=${t.id}`,
        duration: 0,
        uploader: "YouTube Music",
        requester: `<@${btn.user.id}>`,
        requesterId: btn.user.id,
        source: "YouTubeMusic"
      });
      svState(btn.guildId, q);
      await btn.reply({
        content: `Added ${tracks.length} track(s) to queue.`,
        flags: 64
      }).catch(() => {});
      if (!q.currentSong) {
        const play = require("./engine");
        await play.playNext(btn.guildId).catch(() => {});
      }
    } else if (id.startsWith("music_pl_view:")) {
      const pid = id.split(":")[1];
      const tracks = await ys.plist(btn.user.id, pid, 25).catch(() => []);
      const embed = (new btn.client.ebuilder).setColor("#5865F2").setTitle("Tracks").setDescription(tracks.map((t, i) => `\`${i + 1}.\` ${t.title}`).join("\n").slice(0, 3800) || "Empty");
      await btn.reply({
        embeds: [ embed ],
        flags: 64
      }).catch(() => {});
    }
  });
}

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "music" ],
  category: "music",
  description: "Music dashboard — search, recommendations, library, playlists, queue & account",
  options: [],
  run: async ctx => execute(ctx.interaction)
});