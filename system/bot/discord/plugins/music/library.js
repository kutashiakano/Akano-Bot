const ys = require("../../../../scrapers/src/ytsession.js");
const {queues: queues, mkQueue: mkQueue, playNext: playNext} = require("./engine");
const {svState: svState} = require("./state");

const KINDS = {
  y: "Search",
  p: "Playlists",
  l: "Liked",
  k: "Quick Picks"
};

const KINDS2 = {
  search: "y",
  playlists: "p",
  liked: "l",
  picks: "k"
};

const views = new Map;

const PER = 10;

async function sesh(uid) {
  try {
    if (ys.has(uid)) return await ys.getSession(uid);
  } catch (e) {}
  return null;
}

function items(kind, uid) {
  return views.get(uid)?.find(v => v.kind === kind);
}

async function search(kind, q, type, limit = PER) {
  const tm = await global.scraper.ytmusic;
  if (kind === "y") return tm.searchType(q, type, limit);
  return [];
}

async function tvList(kind, uid, limit = PER) {
  if (kind === "p") return (await ys.plists(uid, limit)).map(p => ({
    id: p.id,
    title: p.title,
    artist: "Playlist",
    type: "playlist",
    url: `https://music.youtube.com/playlist?list=${p.id}`
  }));
  if (kind === "l") return (await ys.likes(uid, limit)).map(s => ({
    id: s.id,
    title: s.title,
    artist: "?",
    type: "song",
    url: `https://music.youtube.com/watch?v=${s.id}`,
    thumbnail: "",
    duration: 0
  }));
  if (kind === "k") return (await ys.charts(10)).map(c => ({
    id: c.id,
    title: c.title,
    artist: "Chart",
    type: "playlist",
    url: `https://music.youtube.com/playlist?list=${c.id}`
  }));
  return [];
}

async function fetch(kind, uid, q, type) {
  const s = await sesh(uid);
  if (kind !== "y" && !s) throw new Error("Sign in first via /account login.");
  const list = kind !== "y" && ys.clientOf(uid) !== "WEB" ? await tvList(kind, uid) : await search(kind, q, type);
  views.set(uid, [ ...(views.get(uid) || []).filter(v => v.kind !== kind), {
    kind: kind,
    list: list
  } ]);
  return list;
}

function view(client, kind, list, off = 0) {
  const page = list.slice(off, off + PER);
  const e = (new client.ebuilder).setColor(5793266).setTitle(KINDS[kind]).setDescription(page.length ? page.map((x, i) => `${String(off + i + 1).padStart(2, "0")}. **${x.title || x.name}** — ${x.artist || "?"}`).join("\n") : "Nothing here.").setFooter({
    text: `Page ${off / PER + 1}`
  });
  const rows = [];
  if (page.length) {
    rows.push((new client.abuilder).addComponents(page.slice(0, 5).map((_, i) => (new client.bbuilder).setStyle(client.ButtonStyle.Primary).setLabel(String(off + i + 1)).setCustomId(`lb|${kind}|${off + i}`))));
    rows.push((new client.abuilder).addComponents(page.slice(5, 10).map((_, i) => (new client.bbuilder).setStyle(client.ButtonStyle.Primary).setLabel(String(off + i + 6)).setCustomId(`lb|${kind}|${off + i + 5}`))));
  }
  if (list.length > PER) {
    rows.push((new client.abuilder).addComponents((new client.bbuilder).setStyle(client.ButtonStyle.Secondary).setLabel("◀").setCustomId(`lb|n|${kind}|b`).setDisabled(off === 0), (new client.bbuilder).setStyle(client.ButtonStyle.Secondary).setLabel("▶").setCustomId(`lb|n|${kind}|f`).setDisabled(off + PER >= list.length)));
  }
  return {
    embeds: [ e ],
    components: rows
  };
}

async function queue(tracks, interaction) {
  const gid = interaction.guildId;
  const vc = interaction.member?.voice?.channel;
  if (!vc) return "Join a voice channel first.";
  let queue = queues.get(gid);
  if (!queue) queue = await mkQueue(gid, vc, interaction.channel);
  const first = queue.songs.length === 0 && !queue.currentSong;
  for (const t of tracks) {
    queue.songs.push({
      id: t.id,
      title: t.title || t.name || "Unknown",
      url: t.url,
      webpage_url: t.url,
      thumbnail: t.thumbnail,
      duration: t.duration,
      uploader: t.artist,
      channel: t.artist,
      requester: `<@${interaction.user.id}>`,
      requesterId: interaction.user.id,
      source: "YouTubeMusic"
    });
  }
  if (!first) {
    svState(gid, queue);
    return `${tracks.length} track(s) added to the queue.`;
  }
  svState(gid, queue);
  await playNext(gid);
  return `Loading: **${tracks[0].title || tracks[0].name}**...`;
}

async function play(clk, i) {
  const uid = clk.user.id;
  const view = items(i.split("|")[1], uid)?.list;
  const idx = Number(i.split("|")[2]);
  const item = view?.[idx] || view?.[idx - 1];
  if (!item) {
    return clk.reply({
      content: "Item expired - run the command again.",
      flags: 64
    });
  }
  try {
    if (item.type === "playlist" || item.type === "album") {
      let tracks = [];
      try {
        if (ys.clientOf(uid) !== "WEB") {
          tracks = (await ys.plist(uid, item.id, 20)).map(t => ({
            id: t.id,
            title: t.title,
            artist: "?",
            url: `https://music.youtube.com/watch?v=${t.id}`,
            thumbnail: "",
            duration: 0
          }));
        } else {
          tracks = await global.scraper.ytmusic.plist(item.id, 20, await sesh(uid));
        }
      } catch {}
      if (item.type === "album" && !tracks.length) {
        tracks = await global.scraper.ytmusic.searchType(item.name, "song", 20);
      }
      if (!tracks.length) throw new Error("Cannot expand this item.");
      const msg = await queue(tracks, clk);
      return clk.update({
        content: msg,
        embeds: [],
        components: []
      });
    }
    if (item.type === "artist") {
      const tracks = await global.scraper.ytmusic.searchType(item.name, "song", 10);
      if (!tracks.length) throw new Error("Cannot expand this artist.");
      const msg = await queue(tracks, clk);
      return clk.update({
        content: msg,
        embeds: [],
        components: []
      });
    }
    const msg = await queue([ item ], clk);
    return clk.update({
      content: msg,
      embeds: [],
      components: []
    });
  } catch (e) {
    global.logError("dc.lib.play", e);
    return clk.reply({
      content: "Failed to play that item: " + (e.message || e),
      flags: 64
    });
  }
}

async function nav(clk, kind, dir) {
  const uid = clk.user.id;
  const entry = items(kind, uid);
  if (!entry) return;
  const list = entry.list;
  const off = Math.max(0, Math.min(list.length - PER, (entry.off || 0) + (dir === "f" ? PER : -PER)));
  entry.off = off;
  clk.update(view(clk.client, kind, list, off)).catch(() => {});
}

const __orig = {
  name: "lib",
  description: "Explore YouTube Music - search, playlists, liked, quick picks",
  options: [ {
    name: "search",
    description: "Search songs, albums, artists, videos, or playlists",
    type: 1,
    options: [ {
      name: "q",
      type: 3,
      description: "Search query",
      required: true
    }, {
      name: "type",
      type: 3,
      description: "Result type (default: song)",
      required: false,
      choices: [ "song", "video", "album", "artist", "playlist" ].map(c => ({
        name: c,
        value: c
      }))
    } ]
  }, {
    name: "playlists",
    description: "Browse your YouTube Music playlists",
    type: 1
  }, {
    name: "liked",
    description: "Browse your liked songs",
    type: 1
  }, {
    name: "picks",
    description: "Quick picks personalized for your account",
    type: 1
  } ],
  async execute(interaction) {
    const uid = interaction.user.id;
    try {
      const sub = interaction.options.getSubcommand();
      let q = null;
      let type = null;
      if (sub === "search") {
        q = (interaction.options.getString("q") || "").trim();
        type = interaction.options.getString("type") || "song";
        if (!q) return interaction.reply({
          content: "Provide a search query.",
          flags: 64
        });
      }
      await interaction.deferReply({
        flags: 64
      });
      const list = await fetch(KINDS2[sub], uid, q, type);
      interaction.editReply(view(interaction.client, KINDS2[sub], list)).catch(() => {});
    } catch (e) {
      global.logError("dc.lib", e);
      try {
        if (interaction.deferred) {
          await interaction.editReply({
            content: "🚩 Error: " + (e.message || e)
          });
        } else {
          await interaction.reply({
            content: "🚩 Error: " + (e.message || e),
            flags: 64
          });
        }
      } catch (err) {}
    }
  },
  handleComponent(interaction) {
    const [t, kind, arg] = interaction.customId.split("|");
    if (t !== "lb") return;
    if (kind === "n") return nav(interaction, arg, interaction.customId.split("|")[3]);
    return play(interaction, interaction.customId);
  }
};

const {define: define} = require("../../../plugin");

module.exports = define({
  ...__orig,
  category: "music",
  run: async ctx => {
    const interaction = ctx.interaction;
    const uid = interaction.user.id;
    try {
      const sub = interaction.options.getSubcommand();
      let q = null;
      let type = null;
      if (sub === "search") {
        q = (interaction.options.getString("q") || "").trim();
        type = interaction.options.getString("type") || "song";
        if (!q) return interaction.reply({
          content: "Provide a search query.",
          flags: 64
        });
      }
      await interaction.deferReply({
        flags: 64
      });
      const list = await fetch(KINDS2[sub], uid, q, type);
      interaction.editReply(view(interaction.client, KINDS2[sub], list)).catch(() => {});
    } catch (e) {
      global.logError("dc.lib", e);
      try {
        if (interaction.deferred) {
          await interaction.editReply({
            content: "🚩 Error: " + (e.message || e)
          });
        } else {
          await interaction.reply({
            content: "🚩 Error: " + (e.message || e),
            flags: 64
          });
        }
      } catch (err) {}
    }
  },
  handleComponent(interaction) {
    const [t, kind, arg] = interaction.customId.split("|");
    if (t !== "lb") return;
    if (kind === "n") return nav(interaction, arg, interaction.customId.split("|")[3]);
    return play(interaction, interaction.customId);
  }
});