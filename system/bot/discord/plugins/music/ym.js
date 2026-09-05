const ys = require("../../../../scrapers/src/ytsession.js");
const playCmd = require("./play.js");
const {queues: queues, mkQueue: mkQueue, playNext: playNext} = require("./engine");
const {svState: svState} = require("./state");

const TTL = 2 * 60 * 1e3;

const pending = new Map;

async function sesh(uid) {
  try {
    if (ys.has(uid)) return await ys.getSession(uid);
  } catch (e) {}
  return null;
}

function sel(client, cid, options, placeholder) {
  return (new client.abuilder).addComponents((new client.mbuilder).setCustomId(cid).setPlaceholder(placeholder).addOptions(options.slice(0, 25).map(o => ({
    label: String(o.label || o.title || "?").slice(0, 100),
    value: String(o.value || o.id)
  }))));
}

function lEmb(client, title, lines, empty) {
  return (new client.ebuilder).setColor(15548997).setTitle(title).setDescription(lines.length ? lines.map((l, i) => `\`${i + 1}.\` ${l}`).join("\n") : empty);
}

async function enqTracks(tracks, interaction) {
  const gid = interaction.guildId;
  const vc = interaction.member?.voice?.channel;
  if (!vc) return "Join a voice channel first.";
  let queue = queues.get(gid);
  if (!queue) queue = await mkQueue(gid, vc, interaction.channel); else {
    queue.voiceChannel = vc;
    queue.textChannel = interaction.channel;
  }
  const first = queue.songs.length === 0 && !queue.currentSong;
  for (const t of tracks) {
    queue.songs.push({
      id: t.id,
      title: t.title || "Unknown",
      url: t.url || `https://music.youtube.com/watch?v=${t.id}`,
      thumbnail: t.thumbnail || "",
      duration: t.duration || 0,
      uploader: t.artist || "YouTube Music",
      requester: `<@${interaction.user.id}>`,
      requesterId: interaction.user.id,
      source: "YouTubeMusic"
    });
  }
  svState(gid, queue);
  if (!first) return `${tracks.length} track(s) added to the queue.`;
  await playNext(gid);
  return `Loading: **${tracks[0].title}**...`;
}

async function chartsView(interaction) {
  const list = await ys.charts(25);
  const emb = lEmb(interaction.client, "Charts - YouTube Music", list.map(c => c.title), "Could not load charts.");
  const rows = [];
  if (list.length) rows.push(sel(interaction.client, "ym_chart", list.map(c => ({
    label: c.title,
    value: c.id
  })), "Pick a chart to play…"));
  await interaction.editReply({
    embeds: [ emb ],
    components: rows
  });
  const msg = await interaction.fetchReply();
  const col = msg.createMessageComponentCollector({
    filter: i => i.customId === "ym_chart",
    time: TTL
  });
  col.on("collect", async i => {
    col.stop();
    const id = i.values?.[0];
    if (!id) return i.update({
      content: "Nothing selected.",
      embeds: [],
      components: []
    }).catch(() => {});
    const pl = list.find(c => c.id === id);
    const r = await playCmd.playPanel(i, {
      playlistId: id
    });
    let content = "Playing your chart.";
    if (r && r.error) {
      await i.update({
        content: "Chart can't be played: the chart may require login.",
        embeds: [],
        components: []
      }).catch(() => {});
      return;
    }
    if (pl) content = `Playing chart: **${pl.title}**`;
    await i.update({
      content: content,
      embeds: [],
      components: []
    }).catch(() => {});
  });
}

async function moodsView(interaction) {
  const list = await ys.moods(40);
  if (!list.length) {
    return interaction.editReply({
      embeds: [ lEmb(interaction.client, "Moods & Genres", [], "Could not load moods.") ]
    });
  }
  const emb = lEmb(interaction.client, "Moods & Genres - YouTube Music", list.map(m => m.title), "Nothing here.");
  const links = new Map(list.map(m => [ m.browseId, {
    params: m.params,
    title: m.title
  } ]));
  pending.set(interaction.user.id, links);
  await interaction.editReply({
    embeds: [ emb ],
    components: [ sel(interaction.client, "ym_mood", list.map(m => ({
      label: m.title,
      value: m.browseId
    })), "Pick a mood…") ]
  });
  const msg = await interaction.fetchReply();
  const col = msg.createMessageComponentCollector({
    filter: i => /^ym_mood/.test(i.customId),
    time: TTL
  });
  col.on("collect", async i => {
    const val = i.values?.[0];
    if (i.customId === "ym_mood") {
      const mod = pending.get(interaction.user.id);
      if (!mod || !val) return;
      const info = mod.get(val) || {
        params: "",
        title: "Playlists"
      };
      const pls = await ys.moodPls(val, info.params, 25);
      if (!pls.length) {
        await i.update({
          content: "This mood has no playlists.",
          embeds: [],
          components: []
        }).catch(() => {});
        return;
      }
      const embPl = lEmb(interaction.client, "Playlists › " + info.title, pls.map(p => p.title), "Nothing here.");
      await i.update({
        embeds: [ embPl ],
        components: [ sel(interaction.client, "ym_moodpl", pls.map(p => ({
          label: p.title,
          value: p.id
        })), "Pick a playlist…") ]
      }).catch(() => {});
      return;
    }
    if (i.customId !== "ym_moodpl") return;
    col.stop();
    if (!val) return;
    await i.update({
      content: "Loading playlist…",
      embeds: [],
      components: []
    }).catch(() => {});
    const r = await playCmd.playPanel(i, {
      playlistId: val
    });
    if (r && r.error) {
      await interaction.editReply({
        content: "Could not play that playlist.",
        embeds: [],
        components: []
      }).catch(() => {});
    }
  });
}

async function radioView(interaction, query) {
  let vid = null;
  try {
    if (query) {
      const hits = await global.scraper.ytmusic.sSongs(query, 1, await sesh(interaction.user.id));
      vid = hits?.[0]?.id || null;
    } else {
      const q = queues.get(interaction.guildId);
      const m = String(q?.currentSong?.url || "").match(/[?&]v=([\w-]{6,})/);
      vid = m ? m[1] : null;
    }
  } catch (e) {}
  if (!vid) {
    return interaction.editReply({
      embeds: [ lEmb(interaction.client, "Radio", [], "Nothing is playing. Provide a query or play a song first.") ]
    });
  }
  const tracks = (await ys.radio(interaction.user.id, vid, 20)).filter(t => t.id !== vid);
  if (!tracks.length) {
    return interaction.editReply({
      embeds: [ lEmb(interaction.client, "Radio", [], "Could not start a radio for that song.") ]
    });
  }
  const msg = await enqTracks(tracks, interaction);
  await interaction.editReply({
    content: "Radio from **" + (tracks[0].title || "your song") + "**: " + msg,
    embeds: [],
    components: []
  });
}

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "ym" ],
  category: "music",
  description: "YouTube Music experience - charts, moods & genres, and radio",
  options: [ {
    name: "charts",
    type: 1,
    description: "Browse the top charts on YouTube Music"
  }, {
    name: "moods",
    type: 1,
    description: "Browse moods & genres and play a playlist"
  }, {
    name: "radio",
    type: 1,
    description: "Start a YouTube Music radio from the current song or a query",
    options: [ {
      name: "query",
      type: 3,
      description: "Optional song or artist to start a radio from",
      required: false
    } ]
  } ],
  run: async ctx => {
    const interaction = ctx.interaction;
    try {
      await interaction.deferReply({
        flags: 64
      });
      const sub = interaction.options.getSubcommand();
      if (sub === "charts") return chartsView(interaction);
      if (sub === "moods") return moodsView(interaction);
      const query = (interaction.options.getString("query") || "").trim();
      return radioView(interaction, query);
    } catch (e) {
      global.logError("dc.ym", e);
      try {
        await interaction.editReply({
          content: "🚩 Error: " + (e.message || e)
        });
      } catch {}
    }
  }
});