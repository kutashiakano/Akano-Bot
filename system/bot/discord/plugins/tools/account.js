const ys = require("../../../../scrapers/src/ytsession.js");
const playCmd = require("../music/play.js");

const TTL = 5 * 60 * 1000;
const CID = "acc_btn";

const mem = new Map();

function st(uid) {
  let s = mem.get(uid);
  if (!s) {
    s = {};
    mem.set(uid, s);
  }
  return s;
}

function trunc(s, n = 100) {
  s = String(s || "");
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function selectRow(client, cid, options, placeholder) {
  const menu = new (client.mbuilder)()
    .setCustomId(cid)
    .setPlaceholder(placeholder || "Choose an item…")
    .addOptions(
      options.slice(0, 25).map((o) => ({
        label: trunc(o.label),
        value: String(o.value),
      })),
    );
  return new (client.abuilder)().addComponents(menu);
}

function backBtn(guild) {
  return ic(guild, "back", "Back").setCustomId("acc_back").setStyle(guild.client.ButtonStyle.Secondary);
}

function ic(guild, key, label) {
  return new (guild.client.bbuilder)().setLabel(label);
}

function panelRows(guild, loggedIn) {
  if (loggedIn) {
    return [
      new (guild.client.abuilder)().addComponents(
        ic(guild, "playlist", "Playlists").setCustomId("acc_playlists").setStyle(guild.client.ButtonStyle.Primary),
        ic(guild, "like", "Liked Songs").setCustomId("acc_liked").setStyle(guild.client.ButtonStyle.Primary),
        ic(guild, "refresh", "Refresh").setCustomId("acc_refresh").setStyle(guild.client.ButtonStyle.Secondary),
        ic(guild, "logout", "Sign Out").setCustomId("acc_logout").setStyle(guild.client.ButtonStyle.Danger),
      ),
      new (guild.client.abuilder)().addComponents(
        new (guild.client.bbuilder)()
          .setCustomId(CID)
          .setLabel("Close Panel")
          .setStyle(guild.client.ButtonStyle.Secondary),
      ),
    ];
  }
  return [
    new (guild.client.abuilder)().addComponents(
      ic(guild, "login", "Sign In").setCustomId("acc_login").setStyle(guild.client.ButtonStyle.Success),
    ),
    new (guild.client.abuilder)().addComponents(
      new (guild.client.bbuilder)()
        .setCustomId(CID)
        .setLabel("Close Panel")
        .setStyle(guild.client.ButtonStyle.Secondary),
    ),
  ];
}

function notSignedEmb(client, info) {
  const e = new (client.ebuilder)()
    .setColor(0xed4245)
    .setTitle("Sign In to YouTube Music")
    .setURL(info ? info.url : null)
    .setDescription(
      !info
        ? "You are not signed in to YouTube Music. Press **Sign In** below.\n\nYour per-user session is encrypted and private."
        : `Sign in to unlock:\n\n• **Like songs** straight from the player\n• **Your playlists & liked songs** in one place\n• **Your profile panel** with your stats\n\n**Code:** \`${info.code || "-"}\`\nClick the button below — code auto-filled, just confirm. No extra typing.`
    )
    .setThumbnail(
      "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Youtube_Music_icon.svg/1280px-Youtube_Music_icon.svg.png",
    );
  if (info?.code) e.setFooter({ text: `Code ${info.code} • Expires in 5 min • Use direct link` });
  return e;
}

async function profileSafe(uid) {
  try {
    return await Promise.race([
      ys.profile(uid),
      new Promise((r) => setTimeout(() => r("__TIMEOUT__"), 20000)),
    ]);
  } catch {
    return null;
  }
}

function profEmb(client, a) {
  const e = new (client.ebuilder)().setColor(0xed4245).setTitle("Account");
  if (a === "__INVALID__") {
    e.setDescription(
      "Your saved session is no longer valid (signed in on another device or expired).\n\nPlease sign in again.",
    );
    return e;
  }
  if (!a || a === "__TIMEOUT__") {
    e.setDescription(
      "You are signed in, but your profile could not be fetched (slow connection).\n\nUse **refresh** to retry, or **sign out** and sign in again.",
    );
    return e;
  }
  e.setDescription(a.handle ? "`@" + a.handle + "`" : "YouTube Music");
  if (a.name) e.addFields({ name: "Channel", value: a.name, inline: true });
  if (a.byline) e.addFields({ name: "Account", value: a.byline, inline: true });
  if (a.subs) e.addFields({ name: "Subscribers", value: a.subs, inline: true });
  if (a.videos) e.addFields({ name: "Videos", value: a.videos, inline: true });
  if (a.likes) e.addFields({ name: "Liked Songs", value: a.likes, inline: true });
  if (a.playlists && a.playlists.length)
    e.addFields({
      name: "Playlists (" + a.playlists.length + ")",
      value: a.playlists.slice(0, 12).join(", "),
      inline: false,
    });
  if (a.photo) e.setThumbnail(a.photo);
  return e;
}

function lEmb(client, title, lines, empty) {
  return new (client.ebuilder)()
    .setColor(0xed4245)
    .setTitle(title)
    .setDescription(lines.length ? lines.map((l, i) => `\`${i + 1}.\` ${l}`).join("\n") : empty);
}

async function render(itx, uid, guild) {
  const loggedIn = ys.has(uid);
  if (loggedIn) {
    const a = await profileSafe(uid);
    if (a === "__INVALID__") {
      await itx.editReply({ embeds: [notSignedEmb(guild.client, null)], components: panelRows(guild, false) });
      return;
    }
    await itx.editReply({ embeds: [profEmb(guild.client, a)], components: panelRows(guild, true) });
    return;
  }
  const old = ys.getPend(uid);
  if (old) {
    await itx.editReply({ embeds: [notSignedEmb(guild.client, old)], components: accRows(guild, old) });
  } else {
    startLogin(itx, guild, uid);
  }
}

function accRows(guild, info) {
  return [
    new (guild.client.abuilder)().addComponents(
      new (guild.client.bbuilder)()
        .setStyle(guild.client.ButtonStyle.Link)
        .setLabel("Login to YouTube Music")
        .setURL(info.url),
    ),
  ];
}

async function startLogin(itx, guild, uid) {
  itx.editReply({
    embeds: [new (guild.client.ebuilder)().setColor(0xed4245).setDescription("Preparing sign-in link...")],
    components: [],
  }).catch(() => {});
  ys.login(uid, {
    onPending: (info) => {
      itx.editReply({ embeds: [notSignedEmb(guild.client, info)], components: accRows(guild, info) }).catch(() => {});
    },
    onSuccess: async () => {
      try {
        await itx.editReply({ content: "Signed in", embeds: [], components: [] });
        await render(itx, uid, guild);
      } catch (e) {}
    },
    onTimeout: () => {
      itx
        .editReply({ embeds: [notSignedEmb(guild.client, null)], components: panelRows(guild, false) })
        .catch(() => {});
    },
    onError: (e) => {
      global.logError("dc.account.login", e);
      itx
        .editReply({ embeds: [notSignedEmb(guild.client, null)], components: panelRows(guild, false) })
        .catch(() => {});
    },
  });
}

async function playlistsView(itx, uid, guild) {
  const s = st(uid);
  s.view = "playlists";
  s.tracks = {};
  const ps = await Promise.race([
    ys.plists(uid, 25),
    new Promise((r) => setTimeout(() => r(null), 20000)),
  ]);
  const list = ps || [];
  s.playlists = list;
  const emb = lEmb(guild.client, "Your Playlists", list.map((p) => p.title), "No playlists yet.");
  const rows = [];
  if (list.length)
    rows.push(
      selectRow(guild.client, 
        "acc_sel_pl",
        list.map((p) => ({ label: p.title, value: p.id })),
        "Pick a playlist…",
      ),
    );
  rows.push(
    new (guild.client.abuilder)().addComponents(
      ic(guild, "plus", "New Playlist").setCustomId("acc_newplay").setStyle(guild.client.ButtonStyle.Success),
      backBtn(guild),
    ),
  );
  await itx.editReply({ embeds: [emb], components: rows });
}

async function detailView(itx, uid, guild, pid, ptitle) {
  const s = st(uid);
  s.view = "detail";
  s.detailId = pid;
  s.detailTitle = ptitle;
  const ts = await Promise.race([
    ys.plist(uid, pid, 25),
    new Promise((r) => setTimeout(() => r(null), 20000)),
  ]);
  const list = ts || [];
  s.tracks = {};
  s.detailTracks = list;
  for (const t of list) s.tracks[t.id] = t.title;
  const emb = lEmb(guild.client, 
    ptitle || "Playlist",
    list.map((t) => t.title),
    "This playlist is empty.",
  );
  const rows = [];
  if (list.length)
    rows.push(
      selectRow(guild.client, 
        "acc_sel_tr",
        list.map((t) => ({ label: t.title, value: t.id })),
        "Pick a track…",
      ),
    );
  rows.push(
    new (guild.client.abuilder)().addComponents(
      ic(guild, "play", "Play Playlist")
        .setCustomId("acc_pl_play:" + String(pid).replace(/^VL/, ""))
        .setStyle(guild.client.ButtonStyle.Primary),
      backBtn(guild),
    ),
  );
  await itx.editReply({ embeds: [emb], components: rows });
}

async function likedView(itx, uid, guild) {
  const s = st(uid);
  s.view = "liked";
  const ts = await Promise.race([
    ys.likes(uid, 25),
    new Promise((r) => setTimeout(() => r(null), 20000)),
  ]);
  const list = ts || [];
  s.tracks = {};
  for (const t of list) s.tracks[t.id] = t.title;
  s.likedTracks = list.map((t) => t.id);
  const emb = lEmb(guild.client, 
    "Liked Songs",
    list.map((t) => t.title),
    "No liked songs yet.",
  );
  const rows = [];
  if (list.length)
    rows.push(
      selectRow(guild.client, 
        "acc_sel_tr",
        list.map((t) => ({ label: t.title, value: t.id })),
        "Pick a track…",
      ),
    );
  rows.push(new (guild.client.abuilder)().addComponents(backBtn(guild)));
  await itx.editReply({ embeds: [emb], components: rows });
}

async function trackView(itx, uid, guild, vid) {
  const s = st(uid);
  const isLiked = (s.likedTracks || []).includes(vid);
  if (s.trackId !== vid) s.trackLiked = isLiked;
  if (s.view !== "track") s.trackFrom = isLiked ? "liked" : "detail";
  s.trackId = vid;
  s.view = "track";
  const title = s.tracks?.[vid] || "Unknown track";
  const emb = new (guild.client.ebuilder)()
    .setColor(0xed4245)
    .setTitle(title)
    .setDescription("What would you like to do?");
  const likeLabel = s.trackLiked ? "Unlike" : "Like";
  const rows = [
    new (guild.client.abuilder)().addComponents(
      ic(guild, "play", "Play").setCustomId("acc_play:" + vid).setStyle(guild.client.ButtonStyle.Primary),
      ic(guild, "like", likeLabel)
        .setCustomId(`acc_like:${vid}:${s.trackLiked ? 1 : 0}`)
        .setStyle(s.trackLiked ? guild.client.ButtonStyle.Danger : guild.client.ButtonStyle.Success),
      ic(guild, "add", "Add to Playlist")
        .setCustomId("acc_addpl:" + vid)
        .setStyle(guild.client.ButtonStyle.Secondary),
    ),
    new (guild.client.abuilder)().addComponents(backBtn(guild)),
  ];
  await itx.editReply({ embeds: [emb], components: rows });
}

async function addView(itx, uid, guild, vid) {
  const s = st(uid);
  s.view = "add";
  s.trackId = vid;
  const ps = await Promise.race([
    ys.plists(uid, 25),
    new Promise((r) => setTimeout(() => r(null), 20000)),
  ]);
  const list = ps || [];
  s.playlists = list;
  const title = s.tracks?.[vid] || "Unknown track";
  const emb = new (guild.client.ebuilder)()
    .setColor(0xed4245)
    .setTitle("Add to Playlist")
    .setDescription(`**${title}**\n\nPick a playlist below.`);
  const rows = [];
  if (list.length)
    rows.push(
      selectRow(guild.client, 
        "acc_sel_add",
        list.map((p) => ({ label: p.title, value: p.id })),
        "Pick a playlist…",
      ),
    );
  rows.push(new (guild.client.abuilder)().addComponents(backBtn(guild)));
  await itx.editReply({ embeds: [emb], components: rows });
}

async function handleSelect(i, uid, itx) {
  const guild = itx.guild;
  const s = st(uid);
  const val = i.values?.[0] || "";
  if (i.customId === "acc_sel_pl") {
    await i.deferUpdate().catch(() => {});
    const pl = (s.playlists || []).find((p) => p.id === val);
    await detailView(itx, uid, guild, val, pl ? pl.title : "Playlist");
    return;
  }
  if (i.customId === "acc_sel_tr") {
    await i.deferUpdate().catch(() => {});
    await trackView(itx, uid, guild, val);
    return;
  }
  if (i.customId === "acc_sel_add") {
    const pid = val;
    const vid = s.trackId;
    const title = (s.playlists || []).find((p) => p.id === pid)?.title || pid;
    await i.deferUpdate().catch(() => {});
    const ok = await ys.addPl(uid, pid, vid);
    const e = ok
      ? new (guild.client.ebuilder)()
          .setColor(0x57f287)
          .setDescription(`Added to **${title}**`)
      : new (guild.client.ebuilder)()
          .setColor(0xed4245)
          .setDescription("Couldn't add the song. Try again later.");
    await itx.editReply({ embeds: [e], components: [] });
    return;
  }
  await i.deferUpdate().catch(() => {});
}

async function handleButton(i, uid, itx) {
  const guild = itx.guild;
  const cid = i.customId;
  if (cid === "acc_login") {
    await i.deferUpdate().catch(() => {});
    startLogin(itx, guild, uid);
    return;
  }
  if (cid === "acc_refresh") {
    await i.deferUpdate().catch(() => {});
    await render(itx, uid, guild);
    return;
  }
  if (cid === "acc_logout") {
    await ys.out(uid);
    mem.delete(uid);
    await i.deferUpdate().catch(() => {});
    await render(itx, uid, guild);
    return;
  }
  if (cid === "acc_back") {
    const s = st(uid);
    await i.deferUpdate().catch(() => {});
    if (s.view === "detail") await playlistsView(itx, uid, guild);
    else if (s.view === "track" && s.trackFrom === "detail")
      await detailView(itx, uid, guild, s.detailId, s.detailTitle);
    else if (s.view === "track" && s.trackFrom === "liked") await likedView(itx, uid, guild);
    else if (s.view === "add") await trackView(itx, uid, guild, s.trackId);
    else await render(itx, uid, guild);
    return;
  }
  if (cid === "acc_playlists") {
    await i.deferUpdate().catch(() => {});
    await playlistsView(itx, uid, guild);
    return;
  }
  if (cid === "acc_liked") {
    await i.deferUpdate().catch(() => {});
    await likedView(itx, uid, guild);
    return;
  }
  if (cid === "acc_newplay") {
    const modal = new (guild.client.modal)().setCustomId("acc_modal_newpl").setTitle("New Playlist");
    const input = new (guild.client.textInput)()
      .setCustomId("acc_pl_name")
      .setLabel("Playlist name")
      .setStyle(guild.client.TextInputStyle.Short)
      .setPlaceholder("e.g. My 2026 Favorites")
      .setMaxLength(60)
      .setRequired(true);
    modal.addComponents(new (guild.client.abuilder)().addComponents(input));
    try {
      await i.showModal(modal);
    } catch (e) {}
    try {
      const mi = await i.awaitModalSubmit({
        filter: (m) => m.customId === "acc_modal_newpl",
        time: 60000,
      });
      const name = (mi.fields.getTextInputValue("acc_pl_name") || "").trim();
      if (!name) return;
      const r = await ys.newPl(uid, name);
      const e = r.ok
        ? new (guild.client.ebuilder)().setColor(0x57f287).setDescription(`Playlist **${name}** created`)
        : new (guild.client.ebuilder)().setColor(0xfee75c).setDescription(r.message);
      await mi.reply({ embeds: [e], flags: 64 });
    } catch (e) {}
    return;
  }
  if (cid.startsWith("acc_pl_play:")) {
    const pid = cid.slice("acc_pl_play:".length);
    const r = await playCmd.playPanel(i, { playlistId: pid });
    if (r && r.error) await i.reply({ embeds: [r.error], flags: 64 }).catch(() => {});
    else if (r && r.embed) await i.reply({ embeds: [r.embed] }).catch(() => {});
    else await i.reply({ content: "Playing your playlist." }).catch(() => {});
    return;
  }
  if (cid.startsWith("acc_play:")) {
    const vid = cid.slice("acc_play:".length);
    const s = st(uid);
    const title = s.tracks?.[vid] || "Unknown track";
    const r = await playCmd.playPanel(i, { videoId: vid, title });
    if (r && r.error) await i.reply({ embeds: [r.error], flags: 64 }).catch(() => {});
    else if (r && r.embed) await i.reply({ embeds: [r.embed] }).catch(() => {});
    else await i.reply({ content: "Now playing from your library." }).catch(() => {});
    return;
  }
  if (cid.startsWith("acc_like:")) {
    const parts = cid.split(":");
    const vid = parts[1];
    const likedNow = parts[2] === "1";
    await i.deferUpdate().catch(() => {});
    const ok = await ys.like(uid, vid, !likedNow);
    if (ok) st(uid).trackLiked = !likedNow;
    await trackView(itx, uid, guild, vid);
    return;
  }
  if (cid.startsWith("acc_addpl:")) {
    const vid = cid.slice("acc_addpl:".length);
    await i.deferUpdate().catch(() => {});
    await addView(itx, uid, guild, vid);
    return;
  }
  await i.deferUpdate().catch(() => {});
  await render(itx, uid, guild);
}

async function execute(interaction) {
  const uid = interaction.user.id;
  const dbg = (step) => {
    try {
      require("fs").appendFileSync(
        process.env.HOME + "/.akano-debugaccount.log",
        JSON.stringify({ ts: new Date().toISOString(), uid, step }) + "\n"
      );
    } catch {}
  };
  dbg("execute-start");
  try {
    if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ flags: 64 });
  } catch (e) {
    if (String(e.message || "").includes("already been acknowledged") || String(e.code) === "40060") return;
    throw e;
  }
  dbg("deferred");
  const guild = interaction.guild;
  const loggedIn = ys.has(uid);
  dbg("has-checked " + loggedIn);
  let emb;
  let signedIn = loggedIn;
  if (loggedIn) {
    const a = await profileSafe(uid);
    dbg("profile-done");
    emb = profEmb(guild.client, a);
    if (a === "__INVALID__") {
      signedIn = false;
      emb = notSignedEmb(guild.client, null);
    }
  } else {
    emb = notSignedEmb(guild.client, ys.getPend(uid));
  }
  dbg("pre-editReply");
  const pend = signedIn ? null : ys.getPend(uid);
  await interaction.editReply({
    embeds: [emb],
    components: signedIn
      ? panelRows(guild, true)
      : pend
        ? accRows(guild, pend)
        : panelRows(guild, false),
  });
  dbg("editReply-done");
  const msg = await interaction.fetchReply();
  if (!signedIn && !ys.getPend(uid)) {
    startLogin(interaction, guild, uid);
  }
  const col = msg.createMessageComponentCollector({
    filter: (i) => /^acc_/.test(i.customId),
    time: TTL,
  });
  col.on("collect", async (i) => {
    try {
      if (i.user.id !== uid) {
        await i
          .reply({ content: "This panel is private to its owner.", flags: 64 })
          .catch(() => {});
        return;
      }
      if (i.customId === CID) {
        col.stop();
        await i.update({ content: "Panel closed.", embeds: [], components: [] }).catch(() => {});
        return;
      }
      if (i.isStringSelectMenu()) await handleSelect(i, uid, interaction);
      else await handleButton(i, uid, interaction);
    } catch (e) {
      global.logError("dc.account.button", e);
    }
  });
  col.on("end", async (collected) => {
    if (!collected.size && !ys.has(uid) && !ys.getPend(uid)) {
      interaction
        .editReply({ content: "Panel expired.", embeds: [], components: [] })
        .catch(() => {});
    }
  });
}


const { define } = require("../../../plugin");

module.exports = define({
  name: ["account"],
  category: "tools",
  description: "Manage your YouTube Music session - login, profile, playlists, likes",
  options: [],
  run: async (ctx) => {
    const interaction = ctx.interaction;

    try {
      await execute(interaction);
    } catch (e) {
      global.logError("dc.account", e);
      try {
        if (interaction.deferred) {
          await interaction.editReply({
            content: "🚩 An error occurred. Please try again.",
          });
        } else {
          await interaction.reply({ content: "🚩 An error occurred. Please try again.", flags: 64 });
        }
      } catch (err) {}
    }
  
  },
});
