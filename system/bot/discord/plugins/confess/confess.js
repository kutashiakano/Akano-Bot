import database from "../../../../database/index.js";
import { defineBot as define } from "@kutashiakanocanzy/sdk";
import { ui as makeUi } from "@kutashiakanocanzy/sdk";
import path from "node:path";
const ui = makeUi({ iconsDir: path.join(import.meta.dirname, "../../../website/dashboard/client/icons") });
function cfgOf(db, gid, gname) {
  if (!db.discord) db.discord = { servers: {}, users: {} };
  if (!db.discord.servers) db.discord.servers = {};
  let s = db.discord.servers[gid];
  if (!s || typeof s !== "object") {
    s = { id: gid, name: gname || "", createdAt: new Date().toISOString() };
    db.discord.servers[gid] = s;
  }
  if (!s.confess || typeof s.confess !== "object") s.confess = { channels: [], review: false, color: "#5865F2", logs: false, replies: true, nextId: 1, banned: [], items: {}, pending: {}, authors: {} };
  const c = s.confess;
  if (!Array.isArray(c.channels)) c.channels = [];
  if (!Array.isArray(c.banned)) c.banned = [];
  if (!c.items || typeof c.items !== "object") c.items = {};
  if (!c.pending || typeof c.pending !== "object") c.pending = {};
  if (!c.authors || typeof c.authors !== "object") c.authors = {};
  if (!c.strikeBans || typeof c.strikeBans !== "object") c.strikeBans = {};
  if (typeof c.nextId !== "number") c.nextId = 1;
  if (typeof c.replies !== "boolean") c.replies = true;
  return c;
}
function isMod(interaction) {
  try {
    const P = interaction.client.PermissionFlagsBits;
    if (interaction.memberPermissions) return interaction.memberPermissions.has(P.ManageMessages);
    return !!(interaction.member && interaction.member.permissions && interaction.member.permissions.has(P.ManageMessages));
  } catch (e) {
    return false;
  }
}
function isBanned(c, uid) {
  const id = String(uid);
  try {
    if (c.strikeBans && typeof c.strikeBans === "object") {
      const now = Date.now();
      for (const k of Object.keys(c.strikeBans)) {
        if (!(c.strikeBans[k] > now)) delete c.strikeBans[k];
      }
      if (c.strikeBans[id] > now) return true;
    }
  } catch (e) {}
  try {
    return c.banned.includes(id);
  } catch (e) {
    return false;
  }
}
function colorOf(c) {
  const v = String(c.color || "#5865F2");
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : "#5865F2";
}
function resolveRef(c, ref) {
  const s = String(ref || "").trim();
  const m = s.match(/(?:discord(?:app)?\.com\/channels\/\d+\/\d+\/)?(\d{15,})/);
  if (m) {
    const mid = m[1];
    const found = Object.values(c.items).find(x => x.messageId === mid);
    if (found && !found.removed) return { item: found, id: found.id };
    return { error: "Confession not found in this server. Paste its number or message link." };
  }
  const n = parseInt(s, 10);
  if (!n || isNaN(n) || !c.items[n] || c.items[n].removed) return { error: "Confession not found in this server. Paste its number or message link." };
  return { item: c.items[n], id: n };
}
function parseColor(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  const hex = s[0] === "#" ? s : "#" + s;
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.toUpperCase();
  const map = { red: "#FF0000", blue: "#0000FF", green: "#008000", yellow: "#FFFF00", purple: "#800080", pink: "#FFC0CB", orange: "#FFA500", white: "#FFFFFF", black: "#000000", grey: "#808080", gray: "#808080", cyan: "#00FFFF", teal: "#008080", lime: "#00FF00", brown: "#A52A2A", navy: "#000080" };
  const low = s.toLowerCase();
  if (map[low]) return map[low];
  return null;
}
function prefsOf(db, uid) {
  if (!db.discord) db.discord = { servers: {}, users: {} };
  if (!db.discord.users) db.discord.users = {};
  let u = db.discord.users[uid];
  if (!u || typeof u !== "object") {
    u = { name: "", exp: 0, money: 100, limit: 0, registered: false, premium: false };
    db.discord.users[uid] = u;
  }
  if (!u.confessPrefs || typeof u.confessPrefs !== "object") u.confessPrefs = { initials: "", show: true };
  return u.confessPrefs;
}
function footerOf(db, c, id, authorId) {
  let base = "Report abuse with /confess report id:" + id;
  try {
    const p = authorId && db.discord && db.discord.users && db.discord.users[authorId] ? db.discord.users[authorId].confessPrefs : null;
    if (p && p.show !== false && String(p.initials || "").trim()) base = "by " + String(p.initials).trim().slice(0, 8) + " · " + base;
  } catch (e) {}
  return base;
}
function confessEmbed(c, id, text, footer) {
  return ui.embed().setColor(colorOf(c)).setAuthor({ name: "Anonymous Confession (#" + id + ")", iconURL: "attachment://mask.png" }).setDescription(String(text).slice(0, 1500)).setFooter({ text: footer || ("Report abuse with /confess report id:" + id) }).setTimestamp();
}
async function postConfession(client, channelId, embed, extra, replyToId, allowReply) {
  const ch = await client.channels.fetch(channelId).catch(() => null);
  if (!ch || !ch.isTextBased()) return null;
  const files = ui.file("mask");
  if (extra) files.push(extra);
  let comps = [];
  if (replyToId) {
    if (allowReply === false) comps = [ui.row([ui.btn("cf_poll", "Poll", client.ButtonStyle.Secondary)])];
    else comps = [ui.row([ui.btn("cf_reply_" + replyToId, "Reply", client.ButtonStyle.Primary), ui.btn("cf_poll", "Poll", client.ButtonStyle.Secondary)])];
  }
  return ch.send({ embeds: [embed], files: files, components: comps }).catch(() => null);
}
function userMedia(interaction) {
  try {
    const a = interaction.options.getAttachment("media");
    if (!a || !a.url) return null;
    const url = a.url;
    const name = (a.name || "media").slice(0, 80);
    if (a.size && a.size > 25000000) return { error: "Media is too big (max 25 MB)." };
    return { attachment: url, name: name };
  } catch (e) {
    return null;
  }
}
function queueEmbed(c) {
  const pend = Object.values(c.pending);
  const rep = Object.values(c.items).filter(x => !x.removed && ((x.reports && x.reports.length > 0) || x.hidden));
  const lines = [];
  if (pend.length) {
    lines.push("Pending review:");
    for (const p of pend.slice(0, 10)) lines.push("#" + p.id + " — " + String(p.text).slice(0, 80));
  }
  if (rep.length) {
    lines.push("Reported:");
    for (const x of rep.slice(0, 10)) lines.push("#" + x.id + (x.hidden ? " [HIDDEN]" : "") + " — " + (x.reports || []).length + " report(s): " + String(x.text).slice(0, 60));
  }
  if (!lines.length) lines.push("Queue is empty. Nothing needs attention.");
  return ui.embed().setColor(colorOf(c)).setTitle("Moderation Queue").setDescription(lines.join("\n").slice(0, 1800));
}
function queueRows(client, c) {
  const rows = [];
  const pend = Object.values(c.pending).slice(0, 5);
  const rep = Object.values(c.items).filter(x => !x.removed && ((x.reports && x.reports.length > 0) || x.hidden)).slice(0, 5);
  const mk = [];
  for (const p of pend) {
    mk.push(ui.btn("cf_ap_" + p.id, "Approve #" + p.id, client.ButtonStyle.Success));
    mk.push(ui.btn("cf_del_" + p.id, "Reject #" + p.id, client.ButtonStyle.Danger));
  }
  for (const x of rep) {
    mk.push(ui.btn("cf_keep_" + x.id, "Keep #" + x.id, client.ButtonStyle.Success));
    mk.push(ui.btn("cf_rm_" + x.id, "Remove #" + x.id, client.ButtonStyle.Danger));
  }
  while (mk.length) rows.push(ui.row(mk.splice(0, 5)));
  return rows.slice(0, 5);
}
async function doReply(client, gid, gname, uid, uname, id, text, mediaFile, toN, colorHex) {
  const db = database.get();
  const c = cfgOf(db, String(gid), gname);
  if (c.replies === false) return { error: "Replies are turned off in this server." };
  text = String(text || "").trim().slice(0, 1000);
  if (!text) return { error: "Write your reply first." };
  const item = c.items[id];
  if (!item || item.removed || !item.messageId) return { error: "Confession #" + id + " was not found." };
  if (isBanned(c, String(uid))) return { error: "You are banned from confessing in this server." };
  const ch = await client.channels.fetch(item.channelId).catch(() => null);
  if (!ch || !ch.isTextBased()) return { error: "Original channel is gone." };
  const n = (item.replyCount || 0) + 1;
  if (!item.replies || typeof item.replies !== "object") item.replies = {};
  if (!item.replyIn || typeof item.replyIn !== "object") item.replyIn = {};
  if (toN && !item.replies[toN]) return { error: "Reply #" + id + "." + toN + " was not found. Omit the target to reply to the latest." };
  const inThread = k => {
    const v = item.replyIn[k];
    if (v === true) return true;
    if (v === false) return false;
    return !!item.threadId;
  };
  let thread = null;
  try {
    if (item.threadId) thread = await ch.threads.fetch(item.threadId).catch(() => null);
    if (!thread && item.messageId) {
      const orig = await ch.messages.fetch(item.messageId).catch(() => null);
      if (orig && orig.startThread) thread = await orig.startThread({ name: "Confession #" + id + " discussion", autoArchiveDuration: 1440 }).catch(() => null);
    }
  } catch (e2) {}
  if (thread && thread.archived) {
    try { await thread.setArchived(false).catch(() => {}); } catch (e2) {}
  }
  const nums = Object.keys(item.replies).map(x => parseInt(x, 10)).filter(x => !isNaN(x)).sort((a, b) => a - b);
  const scopeNums = nums.filter(k => inThread(k) === !!thread);
  let quoteId = null;
  let quotedN = 0;
  if (toN) {
    if (!item.replies[toN]) return { error: "Reply #" + id + "." + toN + " was not found." };
    if (inThread(toN) !== !!thread) return { error: "Reply #" + id + "." + toN + " lives " + (inThread(toN) ? "in the thread" : "outside the thread") + ". Omit the target to quote the latest here." };
    quoteId = item.replies[toN];
    quotedN = toN;
  } else if (scopeNums.length) {
    quotedN = scopeNums[scopeNums.length - 1];
    quoteId = item.replies[quotedN];
  } else if (!thread) {
    quoteId = item.messageId;
  }
  let pick = null;
  if (colorHex && /^#[0-9A-Fa-f]{6}$/.test(String(colorHex))) pick = String(colorHex).toUpperCase();
  if (!pick) {
    try {
      const saved = db.discord && db.discord.users && db.discord.users[String(uid)] && db.discord.users[String(uid)].confessPrefs ? db.discord.users[String(uid)].confessPrefs.color : null;
      if (saved && /^#[0-9A-Fa-f]{6}$/.test(String(saved))) pick = String(saved).toUpperCase();
    } catch (e2) {}
  }
  if (!pick) pick = colorOf(c);
  const e = ui.embed().setColor(pick).setAuthor({ name: "Anonymous Reply #" + id + "." + n + (quotedN ? " to #" + id + "." + quotedN : ""), iconURL: "attachment://mask.png" }).setDescription(text).setFooter({ text: footerOf(db, c, id, String(uid)) }).setTimestamp();
  const sendFiles = ui.file("mask");
  if (mediaFile) sendFiles.push(mediaFile);
  const payload = { embeds: [e], files: sendFiles, components: [ui.row([ui.btn("cf_reply_" + id + "_" + n, "Reply", client.ButtonStyle.Primary)])] };
  if (quoteId) payload.reply = { messageReference: quoteId };
  let sent = null;
  if (thread && thread.send) {
    item.threadId = thread.id;
    sent = await thread.send(payload).catch(() => null);
  } else {
    sent = await ch.send(payload).catch(() => null);
  }
  if (!sent) return { error: "Could not deliver the reply. Check bot permissions." };
  item.replyCount = n;
  item.replies[n] = sent.id;
  item.replyIn[n] = !!thread;
  await database.write(db).catch(() => {});
  return { ok: true, n: n };
}
async function handleComponent(interaction) {
  const cid = String(interaction.customId || "");
  if (cid === "cf_poll") {
    const modal = new interaction.client.ModalBuilder().setCustomId("cf_pollmodal").setTitle("Create a Poll");
    const q = new interaction.client.TextInputBuilder().setCustomId("cf_p_q").setLabel("Question").setStyle(interaction.client.TextInputStyle.Short).setRequired(true).setMaxLength(300);
    const o1 = new interaction.client.TextInputBuilder().setCustomId("cf_p_1").setLabel("Option 1").setStyle(interaction.client.TextInputStyle.Short).setRequired(true).setMaxLength(55);
    const o2 = new interaction.client.TextInputBuilder().setCustomId("cf_p_2").setLabel("Option 2").setStyle(interaction.client.TextInputStyle.Short).setRequired(true).setMaxLength(55);
    const o3 = new interaction.client.TextInputBuilder().setCustomId("cf_p_3").setLabel("Option 3").setStyle(interaction.client.TextInputStyle.Short).setRequired(false).setMaxLength(55);
    const o4 = new interaction.client.TextInputBuilder().setCustomId("cf_p_4").setLabel("Option 4").setStyle(interaction.client.TextInputStyle.Short).setRequired(false).setMaxLength(55);
    const A = interaction.client.abuilder;
    modal.addComponents(new A().addComponents(q), new A().addComponents(o1), new A().addComponents(o2), new A().addComponents(o3), new A().addComponents(o4));
    try {
      await interaction.showModal(modal);
    } catch (e) {}
    return;
  }
  const mm = cid.match(/^cf_reply_(\d+)(?:_(\d+))?$/);
  if (!mm) return;
  const id = parseInt(mm[1], 10);
  const qn = mm[2] ? parseInt(mm[2], 10) : null;
  if (!id || isNaN(id)) return;
  const modal = new interaction.client.ModalBuilder().setCustomId(qn ? "cf_modal_" + id + "_" + qn : "cf_modal_" + id).setTitle(qn ? "Reply to #" + id + "." + qn : "Reply to #" + id);
  const msgInput = new interaction.client.TextInputBuilder().setCustomId("cf_f_msg").setLabel("Your Reply").setStyle(interaction.client.TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000).setPlaceholder("Write anonymously. Quotes the latest reply automatically.");
  const A = interaction.client.abuilder;
  modal.addComponents(new A().addComponents(msgInput));
  try {
    await interaction.showModal(modal);
  } catch (e) {}
}
async function handleModal(interaction) {
  const mid = String(interaction.customId || "");
  if (mid === "cf_colormodal") {
    let hex = "";
    try { hex = String(interaction.fields.getTextInputValue("cf_c_hex") || "").trim(); } catch (e) {}
    if (hex[0] !== "#") hex = "#" + hex;
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
      try { await interaction.reply({ content: "Use a hex color like #9B59B6.", flags: 64 }); } catch (e) {}
      return;
    }
    try {
      const db = database.get();
      const c = cfgOf(db, String(interaction.guildId), interaction.guild && interaction.guild.name);
      c.color = hex.toUpperCase();
      await database.write(db).catch(() => {});
    } catch (e) {}
    try { await interaction.reply({ content: "Embed color set to " + hex.toUpperCase() + ".", flags: 64 }); } catch (e) {}
    return;
  }
  if (mid === "cf_pollmodal") {
    let q = "";
    let opts = [];
    try {
      q = String(interaction.fields.getTextInputValue("cf_p_q") || "").trim().slice(0, 300);
      opts = ["cf_p_1", "cf_p_2", "cf_p_3", "cf_p_4"].map(k => {
        try { return String(interaction.fields.getTextInputValue(k) || "").trim().slice(0, 55); } catch (e) { return ""; }
      }).filter(Boolean);
    } catch (e) {}
    if (!q || opts.length < 2) {
      try { await interaction.reply({ content: "Give a question and at least 2 options.", flags: 64 }); } catch (e) {}
      return;
    }
    try {
      const ch = interaction.channel;
      if (ch && ch.isTextBased()) await ch.send({ poll: { question: { text: "[Anonymous] " + q }, answers: opts.map(t => ({ text: t })), duration: 24, allowMultiselect: false } }).catch(() => {});
      await interaction.reply({ content: "Anonymous poll posted.", flags: 64 });
    } catch (e) {}
    return;
  }
  const m2 = mid.match(/^cf_modal_(\d+)(?:_(\d+))?$/);
  if (!m2) return;
  let id = parseInt(m2[1], 10);
  let toN = m2[2] ? parseInt(m2[2], 10) : null;
  if (toN && isNaN(toN)) toN = null;
  let text = "";
  try {
    text = interaction.fields.getTextInputValue("cf_f_msg");
  } catch (e) {}
  if (!id || isNaN(id) || !String(text || "").trim()) {
    try { await interaction.reply({ content: "Write your reply first.", flags: 64 }); } catch (e) {}
    return;
  }
  const dbm = database.get();
  const cm = cfgOf(dbm, String(interaction.guildId), interaction.guild && interaction.guild.name);
  if (cm.replies === false) {
    try { await interaction.reply({ content: "Replies are turned off in this server.", flags: 64 }); } catch (e) {}
    return;
  }
  const rr = resolveRef(cm, String(id));
  if (rr.error) {
    try { await interaction.reply({ content: rr.error, flags: 64 }); } catch (e) {}
    return;
  }
  id = rr.id;
  const r = await doReply(interaction.client, interaction.guildId, interaction.guild && interaction.guild.name, String(interaction.user.id), interaction.user.username, id, text, null, toN, null);
  try {
    if (r.error) await interaction.reply({ content: r.error, flags: 64 });
    else await interaction.reply({ content: "Reply #" + id + "." + r.n + " sent anonymously.", flags: 64 });
  } catch (e) {}
}
const cmd = define({
  name: ["confess"],
  category: "tools",
  description: "Anonymous confessions with moderation, reports, and review queue",
  options: [
    { name: "send", type: 1, description: "Send an anonymous confession", options: [{ name: "message", type: 3, description: "Your confession (posted anonymously)", required: true }, { name: "media", type: 11, description: "Optional image or video to attach", required: false }] },
    { name: "reply", type: 1, description: "Reply anonymously to a confession", options: [{ name: "id", type: 3, description: "Confession number or message link", required: true }, { name: "message", type: 3, description: "Your reply (posted anonymously)", required: true }, { name: "to", type: 4, description: "Quote a specific reply number, example 1 for #2.1", required: false }, { name: "media", type: 11, description: "Optional image or video to attach", required: false }, { name: "color", type: 3, description: "Hex like #9B59B6, CSS name like red, or empty for default", required: false }] },
    { name: "report", type: 1, description: "Report an abusive confession", options: [{ name: "id", type: 4, description: "Confession number", required: true }, { name: "reason", type: 3, description: "Why is it abusive", required: false }] },
    { name: "queue", type: 1, description: "Show pending and reported confessions (staff)" },
    { name: "approve", type: 1, description: "Approve a pending confession (staff)", options: [{ name: "id", type: 4, description: "Pending number", required: true }] },
    { name: "reject", type: 1, description: "Reject a pending confession (staff)", options: [{ name: "id", type: 4, description: "Pending number", required: true }] },
    { name: "ban", type: 1, description: "Ban a user from confessing (staff)", options: [{ name: "user", type: 6, description: "User to ban", required: true }] },
    { name: "unban", type: 1, description: "Unban a user (staff)", options: [{ name: "user_id", type: 3, description: "User ID to unban", required: true }] },
    { name: "channel", type: 1, description: "Manage confession channels (staff)", options: [{ name: "action", type: 3, description: "Add, remove, or show", required: true, choices: [{ name: "add", value: "add" }, { name: "remove", value: "remove" }, { name: "show", value: "show" }] }, { name: "target", type: 7, description: "Channel for add/remove", required: false }] },
    { name: "review", type: 1, description: "Toggle pre-approval review mode (staff)", options: [{ name: "mode", type: 3, description: "On or off", required: true, choices: [{ name: "on", value: "on" }, { name: "off", value: "off" }] }] },
    { name: "color", type: 1, description: "Set embed color, hex like #9B59B6 (staff)", options: [{ name: "hex", type: 3, description: "Hex color", required: true }] },
    { name: "logs", type: 1, description: "Toggle author logging with transparency (staff)", options: [{ name: "mode", type: 3, description: "On or off", required: true, choices: [{ name: "on", value: "on" }, { name: "off", value: "off" }] }] },
    { name: "checklogs", type: 1, description: "Check if this server logs confession authors" },
    { name: "setup", type: 1, description: "Guided setup: channels, review, logs (staff)" },
    { name: "config", type: 1, description: "Show server configuration panel (staff)" },
    { name: "stats", type: 1, description: "Server confession statistics" },
    { name: "settings", type: 1, description: "Your personal confession settings", options: [{ name: "initials", type: 3, description: "Initials shown in footer, example T (max 8)", required: false }, { name: "show", type: 3, description: "Show or hide your initials", required: false, choices: [{ name: "show", value: "on" }, { name: "hide", value: "off" }] }, { name: "color", type: 3, description: "Default reply color hex like #9B59B6 or CSS name like red", required: false }] },
    { name: "poll", type: 1, description: "Post an anonymous poll", options: [{ name: "question", type: 3, description: "Poll question", required: true }, { name: "option1", type: 3, description: "Choice 1", required: true }, { name: "option2", type: 3, description: "Choice 2", required: true }, { name: "option3", type: 3, description: "Choice 3", required: false }, { name: "option4", type: 3, description: "Choice 4", required: false }, { name: "hours", type: 4, description: "Poll length in hours (default 24, max 168)", required: false, min_value: 1, max_value: 168 }] },
    { name: "delete", type: 1, description: "Delete your own confession (staff can delete any)", options: [{ name: "id", type: 4, description: "Confession number", required: true }] },
    { name: "edit", type: 1, description: "Edit your own confession text", options: [{ name: "id", type: 4, description: "Confession number", required: true }, { name: "message", type: 3, description: "New text", required: true }] }
  ],
  run: async ctx => {
    const interaction = ctx.interaction;
    const client = interaction.client;
    let pre = null;
    try { pre = interaction.options.getSubcommand(); } catch (e) {}
    if (pre === "poll") {
      const db0 = database.get();
      const c0 = cfgOf(db0, String(interaction.guildId), interaction.guild && interaction.guild.name);
      if (isBanned(c0, String(interaction.user.id))) {
        try { await interaction.reply({ content: "You are banned from confessing in this server.", flags: 64 }); } catch (e) {}
        return;
      }
      const q = String(interaction.options.getString("question") || "").trim().slice(0, 300);
      const answers = [interaction.options.getString("option1"), interaction.options.getString("option2"), interaction.options.getString("option3"), interaction.options.getString("option4")].filter(Boolean).map(t => String(t).trim().slice(0, 55)).filter(Boolean);
      if (!q || answers.length < 2) {
        try { await interaction.reply({ content: "Give a question and at least 2 options.", flags: 64 }); } catch (e) {}
        return;
      }
      const hours = Math.min(168, Math.max(1, interaction.options.getInteger("hours") || 24));
      try {
        await interaction.reply({ content: "Anonymous poll posted.", flags: 64 });
        const target = c0.channels.length ? await client.channels.fetch(c0.channels[0]).catch(() => null) : interaction.channel;
        if (target && target.isTextBased()) await target.send({ poll: { question: { text: "[Anonymous] " + q }, answers: answers.map(t => ({ text: t })), duration: hours, allowMultiselect: false } }).catch(() => {});
      } catch (e) {}
      return;
    }
    try { await interaction.deferReply({ flags: 64 }); } catch (e) { return; }
    if (!interaction.guildId) {
      await interaction.editReply({ content: "Use this command inside a server." }).catch(() => {});
      return;
    }
    let sub = "send";
    try { sub = interaction.options.getSubcommand() || "send"; } catch (e) {}
    const db = database.get();
    const c = cfgOf(db, String(interaction.guildId), interaction.guild && interaction.guild.name);
    const save = async () => { await database.write(db).catch(() => {}); };
    const needMod = async () => {
      if (isMod(interaction)) return true;
      await interaction.editReply({ content: "Staff only. You need Manage Messages permission." }).catch(() => {});
      return false;
    };
    if (sub === "send") {
      const text = String(interaction.options.getString("message") || "").trim().slice(0, 1500);
      if (!text) {
        await interaction.editReply({ content: "Write your confession first." }).catch(() => {});
        return;
      }
      if (isBanned(c, String(interaction.user.id))) {
        await interaction.editReply({ content: "You are banned from confessing in this server." }).catch(() => {});
        return;
      }
      if (!c.channels.length) {
        await interaction.editReply({ content: "No confession channel is set up yet. Staff can add one with /confess channel." }).catch(() => {});
        return;
      }
      const id = c.nextId++;
      c.authors[id] = String(interaction.user.id);
      if (c.review) {
        const m0 = userMedia(interaction);
        if (m0 && m0.error) {
          c.nextId--;
          delete c.authors[id];
          await interaction.editReply({ content: m0.error }).catch(() => {});
          return;
        }
        c.pending[id] = { id: id, text: text, time: Date.now(), media: m0 && m0.attachment ? { url: m0.attachment, name: m0.name } : null };
        await save();
        await interaction.editReply({ content: "Your confession (#" + id + ") was sent for staff review. It will appear once approved." }).catch(() => {});
        return;
      }
      const m1 = userMedia(interaction);
      if (m1 && m1.error) {
        c.nextId--;
        delete c.authors[id];
        await interaction.editReply({ content: m1.error }).catch(() => {});
        return;
      }
      const msg = await postConfession(client, c.channels[0], confessEmbed(c, id, text, footerOf(db, c, id, String(interaction.user.id))), m1, id, c.replies !== false);
      c.items[id] = { id: id, channelId: c.channels[0], messageId: msg ? msg.id : null, text: text, time: Date.now(), reports: [], removed: false };
      await save();
      await interaction.editReply({ content: "Your confession (#" + id + ") was posted anonymously." }).catch(() => {});
      return;
    }
    if (sub === "reply") {
      const rawId = String(interaction.options.getString("id") || "").trim();
      const text = String(interaction.options.getString("message") || "").trim().slice(0, 1000);
      const toN = interaction.options.getInteger("to");
      const colorHex = parseColor(interaction.options.getString("color"));
      const m2 = userMedia(interaction);
      if (m2 && m2.error) {
        await interaction.editReply({ content: m2.error }).catch(() => {});
        return;
      }
      if (c.replies === false) {
        await interaction.editReply({ content: "Replies are turned off in this server." }).catch(() => {});
        return;
      }
      const found = resolveRef(c, rawId);
      if (found.error) {
        await interaction.editReply({ content: found.error }).catch(() => {});
        return;
      }
      const id = found.id;
      const r = await doReply(client, String(interaction.guildId), interaction.guild && interaction.guild.name, String(interaction.user.id), interaction.user.username, id, text, m2, toN, colorHex);
      if (r.error) {
        await interaction.editReply({ content: r.error }).catch(() => {});
        return;
      }
      await interaction.editReply({ content: "Reply #" + id + "." + r.n + " sent anonymously in the confession thread." }).catch(() => {});
      return;
    }
    if (sub === "report") {
      const id = interaction.options.getInteger("id");
      const reason = String(interaction.options.getString("reason") || "No reason given").slice(0, 300);
      const item = c.items[id];
      if (!item || item.removed) {
        await interaction.editReply({ content: "Confession #" + id + " was not found." }).catch(() => {});
        return;
      }
      if (!item.reports) item.reports = [];
      if (item.reports.some(r => r.by === String(interaction.user.id))) {
        await interaction.editReply({ content: "You already reported #" + id + "." }).catch(() => {});
        return;
      }
      let joinTs = 0;
      try {
        joinTs = Number(interaction.member && interaction.member.joinedTimestamp) || 0;
      } catch (e) {}
      const counted = joinTs > 0 && (Date.now() - joinTs) >= 3 * 24 * 60 * 60 * 1000;
      item.reports.push({ by: String(interaction.user.id), reason: reason, time: Date.now(), joinedAt: joinTs, counted: counted });
      let auto = "";
      let note = "";
      if (!counted) note = " Your report was recorded, but accounts joined less than 3 days ago do not count toward review.";
      const trusted = item.reports.filter(r => r.counted !== false).length;
      if (trusted >= 3 && !item.hidden) {
        item.hidden = true;
        try {
          const ch = await client.channels.fetch(item.channelId).catch(() => null);
          const orig = ch && item.messageId ? await ch.messages.fetch(item.messageId).catch(() => null) : null;
          if (orig) await orig.edit({ embeds: [ui.embed().setColor("#EAB308").setTitle("Confession #" + id).setDescription("This confession is under staff review.")] }).catch(() => {});
        } catch (e) {}
        auto = " It reached 3 trusted reports and is now hidden for staff review.";
      }
      await save();
      await interaction.editReply({ content: "Report on #" + id + " recorded." + note + auto }).catch(() => {});
      return;
    }
    if (sub === "checklogs") {
      await interaction.editReply({ content: (c.logs ? "Author logging is ON in this server. Your user ID is stored with each confession you send." : "Author logging is OFF in this server. Confessions are fully anonymous.") + " 3 reports from members joined 3+ days hide a post for review; false reports earn strikes." }).catch(() => {});
      return;
    }
    if (sub === "stats") {
      const items = Object.values(c.items).filter(x => !x.removed);
      const replies = items.reduce((n, x) => n + (x.replyCount || 0), 0);
      const pend = Object.keys(c.pending).length;
      const e = ui.embed().setColor(colorOf(c)).setAuthor({ name: "Confession Stats", iconURL: "attachment://mask.png" }).addFields(
        { name: "Live Confessions", value: String(items.length), inline: true },
        { name: "Thread Replies", value: String(replies), inline: true },
        { name: "Pending Review", value: String(pend), inline: true },
        { name: "Channels", value: c.channels.length ? c.channels.map(id => "<#" + id + ">").join(" ") : "None set", inline: false }
      ).setTimestamp();
      const files = ui.file("mask");
      await interaction.editReply({ embeds: [e], files: files }).catch(() => {});
      return;
    }
    if (sub === "delete") {
      const id = interaction.options.getInteger("id");
      const item = c.items[id];
      if (!item || item.removed) {
        await interaction.editReply({ content: "Confession #" + id + " was not found." }).catch(() => {});
        return;
      }
      const mine = c.authors[id] === String(interaction.user.id);
      if (!mine && !isMod(interaction)) {
        await interaction.editReply({ content: "Only the author or staff can delete #" + id + "." }).catch(() => {});
        return;
      }
      item.removed = true;
      try {
        const ch = await client.channels.fetch(item.channelId).catch(() => null);
        const orig = ch && item.messageId ? await ch.messages.fetch(item.messageId).catch(() => null) : null;
        if (orig) await orig.edit({ embeds: [ui.embed().setColor("#99AAB5").setTitle("Confession #" + id).setDescription("This confession was deleted.")] }).catch(() => {});
      } catch (e) {}
      await save();
      await interaction.editReply({ content: "Deleted #" + id + "." }).catch(() => {});
      return;
    }
    if (sub === "edit") {
      const id = interaction.options.getInteger("id");
      const text = String(interaction.options.getString("message") || "").trim().slice(0, 1500);
      const item = c.items[id];
      if (!item || item.removed) {
        await interaction.editReply({ content: "Confession #" + id + " was not found." }).catch(() => {});
        return;
      }
      if (c.authors[id] !== String(interaction.user.id)) {
        await interaction.editReply({ content: "Only the author can edit #" + id + "." }).catch(() => {});
        return;
      }
      if (!text) {
        await interaction.editReply({ content: "Write the new text first." }).catch(() => {});
        return;
      }
      item.text = text;
      try {
        const ch = await client.channels.fetch(item.channelId).catch(() => null);
        const orig = ch && item.messageId ? await ch.messages.fetch(item.messageId).catch(() => null) : null;
        if (orig) await orig.edit({ embeds: [confessEmbed(c, id, text, footerOf(db, c, id, c.authors[id]))] }).catch(() => {});
      } catch (e) {}
      await save();
      await interaction.editReply({ content: "Edited #" + id + "." }).catch(() => {});
      return;
    }
    if (sub === "settings") {
      const prefs = prefsOf(db, String(interaction.user.id));
      const ini = interaction.options.getString("initials");
      const show = interaction.options.getString("show");
      const colorOpt = interaction.options.getString("color");
      if (colorOpt !== null && colorOpt !== undefined) {
        const t = String(colorOpt).trim();
        if (!t) delete prefs.color;
        else {
          const hex = parseColor(t);
          if (!hex) {
            await interaction.editReply({ content: "Invalid color. Use hex like #9B59B6 or a CSS name like red." }).catch(() => {});
            return;
          }
          prefs.color = hex;
        }
      }
      if (ini !== null && ini !== undefined) {
        prefs.initials = String(ini).trim().slice(0, 8);
      }
      if (show === "on") prefs.show = true;
      if (show === "off") prefs.show = false;
      await save();
      const state = prefs.show !== false && prefs.initials ? "Footer shows by " + prefs.initials : "Initials hidden" + (prefs.initials ? " (saved: " + prefs.initials + ")" : " (none set)");
      const cstate = prefs.color ? " Default reply color " + prefs.color + "." : " Reply color follows server default.";
      await interaction.editReply({ content: "Your confession settings: " + state + "." + cstate + " Markdown like bold, italic, and spoiler works in confessions." }).catch(() => {});
      return;
    }
    if (!(await needMod())) return;
    const configPanel = (cc) => {
      const src = cc || c;
      const list = src.channels.length ? src.channels.map(id => "<#" + id + ">").join(" ") : "None set";
      return ui.embed().setColor(colorOf(src)).setAuthor({ name: "Server Configuration", iconURL: "attachment://mask.png" }).addFields(
        { name: "Channels", value: "Confessions: " + list + "\nReplies: " + (src.replies !== false ? "ON" : "OFF"), inline: false },
        { name: "Review", value: src.review ? "ON — posts need approval via /confess queue" : "OFF — posts go live instantly", inline: false },
        { name: "Author Logs", value: src.logs ? "ON — user IDs stored, users warned via /confess checklogs" : "OFF — fully anonymous", inline: false },
        { name: "Embed Color", value: colorOf(src), inline: true },
        { name: "Totals", value: Object.keys(src.items).length + " confessions, " + Object.keys(src.pending).length + " pending", inline: true }
      ).setTimestamp();
    };
    if (sub === "config") {
      const e = configPanel();
      const files = ui.file("mask");
      await interaction.editReply({ embeds: [e], files: files, components: [ui.row([ui.btn("cf_cfg_rev", "Review: " + (c.review ? "ON" : "OFF"), client.ButtonStyle.Primary), ui.btn("cf_cfg_replies", "Replies: " + (c.replies !== false ? "ON" : "OFF"), client.ButtonStyle.Primary), ui.btn("cf_cfg_log", "Logs: " + (c.logs ? "ON" : "OFF"), client.ButtonStyle.Secondary), ui.btn("cf_cfg_color", "Set Color", client.ButtonStyle.Secondary)])] }).catch(() => {});
      const msg = await freshMsg();
      if (!msg) return;
      const col = await ui.collect(msg, i => i.customId.indexOf("cf_cfg_") === 0 && i.user.id === String(interaction.user.id) && isMod(i) && !i.user.bot, 300000, ui.strip);
      if (!col) return;
      col.on("collect", async i => {
        const d2 = database.get();
        const c2 = cfgOf(d2, String(i.guildId), i.guild && i.guild.name);
        if (i.customId === "cf_cfg_rev") {
          c2.review = !c2.review;
          await database.write(d2).catch(() => {});
          const e2 = configPanel(c2);
          const r2 = [ui.row([ui.btn("cf_cfg_rev", "Review: " + (c2.review ? "ON" : "OFF"), client.ButtonStyle.Primary), ui.btn("cf_cfg_replies", "Replies: " + (c2.replies !== false ? "ON" : "OFF"), client.ButtonStyle.Primary), ui.btn("cf_cfg_log", "Logs: " + (c2.logs ? "ON" : "OFF"), client.ButtonStyle.Secondary), ui.btn("cf_cfg_color", "Set Color", client.ButtonStyle.Secondary)])];
          try { await i.update({ embeds: [e2], components: r2 }); } catch (e3) {}
          return;
        }
        if (i.customId === "cf_cfg_replies") {
          c2.replies = !(c2.replies !== false);
          await database.write(d2).catch(() => {});
          const e2 = configPanel(c2);
          const r2 = [ui.row([ui.btn("cf_cfg_rev", "Review: " + (c2.review ? "ON" : "OFF"), client.ButtonStyle.Primary), ui.btn("cf_cfg_replies", "Replies: " + (c2.replies !== false ? "ON" : "OFF"), client.ButtonStyle.Primary), ui.btn("cf_cfg_log", "Logs: " + (c2.logs ? "ON" : "OFF"), client.ButtonStyle.Secondary), ui.btn("cf_cfg_color", "Set Color", client.ButtonStyle.Secondary)])];
          try { await i.update({ embeds: [e2], components: r2 }); } catch (e3) {}
          return;
        }
        if (i.customId === "cf_cfg_log") {
          c2.logs = !c2.logs;
          await database.write(d2).catch(() => {});
          const e2 = configPanel(c2);
          const r2 = [ui.row([ui.btn("cf_cfg_rev", "Review: " + (c2.review ? "ON" : "OFF"), client.ButtonStyle.Primary), ui.btn("cf_cfg_replies", "Replies: " + (c2.replies !== false ? "ON" : "OFF"), client.ButtonStyle.Primary), ui.btn("cf_cfg_log", "Logs: " + (c2.logs ? "ON" : "OFF"), client.ButtonStyle.Secondary), ui.btn("cf_cfg_color", "Set Color", client.ButtonStyle.Secondary)])];
          try { await i.update({ embeds: [e2], components: r2 }); } catch (e3) {}
          return;
        }
        if (i.customId === "cf_cfg_color") {
          const modal = new interaction.client.ModalBuilder().setCustomId("cf_colormodal").setTitle("Embed Color");
          const hex = new interaction.client.TextInputBuilder().setCustomId("cf_c_hex").setLabel("Hex color like #9B59B6").setStyle(interaction.client.TextInputStyle.Short).setRequired(true).setMaxLength(7).setValue(colorOf(c2));
          modal.addComponents(new interaction.client.abuilder().addComponents(hex));
          try { await i.showModal(modal); } catch (e3) {}
          return;
        }
      });
      return;
    }
    if (sub === "setup") {
      const authorId = String(interaction.user.id);
      const step1 = ui.embed().setColor(colorOf(c)).setAuthor({ name: "Confessions Setup", iconURL: "attachment://mask.png" }).setTitle("Step 1/4 — Confessions Channel").setDescription("Select one or more channels where confessions will be posted.");
      const chSel = new interaction.client.ChannelSelectMenuBuilder().setCustomId("cf_setup_ch").setPlaceholder("Select confession channels").setMinValues(1).setMaxValues(3);
      const cancelRow = ui.row([ui.btn("cf_setup_cancel", "Cancel", client.ButtonStyle.Danger)]);
      const files = ui.file("mask");
      await interaction.editReply({ embeds: [step1], files: files, components: [ui.row([chSel]), cancelRow] }).catch(() => {});
      const msg = await freshMsg();
      if (!msg) return;
      const col = await ui.collect(msg, i => (i.customId === "cf_setup_ch" || i.customId === "cf_setup_cancel" || i.customId === "cf_setup_rev_on" || i.customId === "cf_setup_rev_off" || i.customId === "cf_setup_log_on" || i.customId === "cf_setup_log_off" || i.customId === "cf_setup_done") && i.user.id === authorId && isMod(i) && !i.user.bot, 300000, ui.strip);
      if (!col) return;
      col.on("collect", async i => {
        const d2 = database.get();
        const c2 = cfgOf(d2, String(i.guildId), i.guild && i.guild.name);
        const again = async (embed, comps) => {
          try { await i.update({ embeds: [embed], components: comps }); } catch (e2) {}
        };
        if (i.customId === "cf_setup_cancel") {
          try { await i.update({ embeds: [ui.embed().setColor("#99AAB5").setTitle("Setup Cancelled").setDescription("Nothing was changed.")], components: [] }); } catch (e2) {}
          try { col.stop(); } catch (e2) {}
          return;
        }
        if (i.customId === "cf_setup_ch") {
          const ids = (i.values || []).filter(Boolean).slice(0, 3);
          const valid = [];
          for (const cid of ids) {
            const chx = await client.channels.fetch(cid).catch(() => null);
            if (chx && chx.isTextBased()) valid.push(cid);
          }
          if (!valid.length) {
            try { await i.reply({ content: "Pick at least one text channel.", flags: 64 }); } catch (e2) {}
            return;
          }
          c2.channels = valid;
          await database.write(d2).catch(() => {});
          const e2 = ui.embed().setColor(colorOf(c2)).setAuthor({ name: "Confessions Setup", iconURL: "attachment://mask.png" }).setTitle("Step 2/4 — Review Channel").setDescription("Channels saved: " + valid.map(x => "<#" + x + ">").join(" ") + "\n\nReview confessions before they are posted?");
          await again(e2, [ui.row([ui.btn("cf_setup_rev_on", "Review ON", client.ButtonStyle.Success), ui.btn("cf_setup_rev_off", "Post Instantly", client.ButtonStyle.Primary)]), cancelRow]);
          return;
        }
        if (i.customId === "cf_setup_rev_on" || i.customId === "cf_setup_rev_off") {
          c2.review = i.customId === "cf_setup_rev_on";
          await database.write(d2).catch(() => {});
          const e2 = ui.embed().setColor(colorOf(c2)).setAuthor({ name: "Confessions Setup", iconURL: "attachment://mask.png" }).setTitle("Step 3/4 — Author Logs").setDescription("Review mode " + (c2.review ? "ON. Approve posts via /confess queue." : "OFF.") + "\n\nLog author IDs for posted confessions? Users are always told via /confess checklogs.");
          await again(e2, [ui.row([ui.btn("cf_setup_log_on", "Logs ON", client.ButtonStyle.Success), ui.btn("cf_setup_log_off", "Logs OFF", client.ButtonStyle.Primary)]), cancelRow]);
          return;
        }
        if (i.customId === "cf_setup_log_on" || i.customId === "cf_setup_log_off") {
          c2.logs = i.customId === "cf_setup_log_on";
          await database.write(d2).catch(() => {});
          const e2 = ui.embed().setColor(colorOf(c2)).setAuthor({ name: "Confessions Setup", iconURL: "attachment://mask.png" }).setTitle("Step 4/4 — Done").setDescription("Confessions: " + (c2.channels.length ? c2.channels.map(x => "<#" + x + ">").join(" ") : "None") + "\nReview: " + (c2.review ? "ON" : "OFF") + "\nAuthor Logs: " + (c2.logs ? "ON" : "OFF") + "\nColor: " + colorOf(c2) + "\n\nMembers can now use /confess send. Tune anytime via /confess config.");
          await again(e2, []);
          try { col.stop(); } catch (e2) {}
          return;
        }
      });
      return;
    }
    const freshMsg = async () => {
      try { return await interaction.fetchReply(); } catch (e) { return null; }
    };
    if (sub === "queue") {
      const e = queueEmbed(c);
      const rows = queueRows(client, c);
      await interaction.editReply({ embeds: [e], components: rows }).catch(() => {});
      if (!rows.length) return;
      const msg = await freshMsg();
      if (!msg) return;
      const col = await ui.collect(msg, i => i.customId.indexOf("cf_") === 0 && isMod(i) && !i.user.bot, 300000, ui.strip);
      if (!col) return;
      col.on("collect", async i => {
        const parts = i.customId.split("_");
        const act = parts[1];
        const id = parseInt(parts[2], 10);
        const d2 = database.get();
        const c2 = cfgOf(d2, String(i.guildId), i.guild && i.guild.name);
        const done = async text => {
          await database.write(d2).catch(() => {});
          const e2 = queueEmbed(c2);
          const r2 = queueRows(client, c2);
          try { await i.update({ content: text, embeds: [e2], components: r2 }); } catch (e3) {}
          if (!r2.length) {
            try { col.stop(); } catch (e3) {}
          }
        };
        if (act === "ap") {
          const p = c2.pending[id];
          if (!p) {
            try { await i.reply({ content: "Pending #" + id + " is gone.", flags: 64 }); } catch (e3) {}
            return;
          }
          delete c2.pending[id];
          const posted = await postConfession(client, (c2.channels[0] || null), confessEmbed(c2, id, p.text, footerOf(d2, c2, id, c2.authors[id])), p.media ? { attachment: p.media.url, name: p.media.name } : null, id, c2.replies !== false);
          c2.items[id] = { id: id, channelId: c2.channels[0] || null, messageId: posted ? posted.id : null, text: p.text, time: Date.now(), reports: [], removed: false };
          await done("Approved #" + id + ".");
          return;
        }
        if (act === "del") {
          delete c2.pending[id];
          await done("Rejected #" + id + ".");
          return;
        }
        if (act === "keep") {
          const x = c2.items[id];
          let struck = 0;
          if (x) {
            const counted = (x.reports || []).filter(r => r.counted !== false);
            if (!d2.discord) d2.discord = { servers: {}, users: {} };
            if (!d2.discord.users) d2.discord.users = {};
            for (const r of counted) {
              const uid = String(r.by);
              let u = d2.discord.users[uid];
              if (!u || typeof u !== "object") {
                u = { name: "", exp: 0, money: 100, limit: 0, registered: false, premium: false };
                d2.discord.users[uid] = u;
              }
              u.confessStrikes = (Number(u.confessStrikes) || 0) + 1;
              struck++;
              if (u.confessStrikes >= 3) {
                if (!Array.isArray(c2.banned)) c2.banned = [];
                if (!c2.banned.includes(uid)) c2.banned.push(uid);
                if (!c2.strikeBans || typeof c2.strikeBans !== "object") c2.strikeBans = {};
                c2.strikeBans[uid] = Date.now() + 7 * 24 * 60 * 60 * 1000;
              }
            }
            x.reports = [];
            if (x.hidden) {
              x.hidden = false;
              try {
                const ch = await client.channels.fetch(x.channelId).catch(() => null);
                const orig = ch && x.messageId ? await ch.messages.fetch(x.messageId).catch(() => null) : null;
                if (orig) await orig.edit({ embeds: [confessEmbed(c2, id, x.text, footerOf(d2, c2, id, c2.authors[id]))] }).catch(() => {});
              } catch (e3) {}
            }
          }
          await done("Reports on #" + id + " dismissed. " + struck + " false-report strike(s) issued.");
          return;
        }
        if (act === "rm") {
          const x = c2.items[id];
          if (x) {
            x.removed = true;
            try {
              const ch = await client.channels.fetch(x.channelId).catch(() => null);
              const orig = ch && x.messageId ? await ch.messages.fetch(x.messageId).catch(() => null) : null;
              if (orig) await orig.edit({ embeds: [ui.embed().setColor("#ED4245").setTitle("Confession #" + id).setDescription("This confession was removed by a server moderator.")] }).catch(() => {});
            } catch (e3) {}
          }
          await done("Removed #" + id + ".");
          return;
        }
      });
      return;
    }
    if (sub === "approve" || sub === "reject") {
      const id = interaction.options.getInteger("id");
      const p = c.pending[id];
      if (!p) {
        await interaction.editReply({ content: "Pending #" + id + " was not found." }).catch(() => {});
        return;
      }
      delete c.pending[id];
      if (sub === "approve") {
        const posted = await postConfession(client, (c.channels[0] || null), confessEmbed(c, id, p.text, footerOf(db, c, id, c.authors[id])), p.media ? { attachment: p.media.url, name: p.media.name } : null, id, c.replies !== false);
        c.items[id] = { id: id, channelId: c.channels[0] || null, messageId: posted ? posted.id : null, text: p.text, time: Date.now(), reports: [], removed: false };
        await save();
        await interaction.editReply({ content: "Approved #" + id + "." }).catch(() => {});
        return;
      }
      await save();
      await interaction.editReply({ content: "Rejected #" + id + "." }).catch(() => {});
      return;
    }
    if (sub === "ban") {
      const target = interaction.options.getUser("user");
      if (!target || target.bot) {
        await interaction.editReply({ content: "Pick a real user to ban." }).catch(() => {});
        return;
      }
      if (!c.banned.includes(String(target.id))) c.banned.push(String(target.id));
      await save();
      await interaction.editReply({ content: target.username + " is banned from confessing." }).catch(() => {});
      return;
    }
    if (sub === "unban") {
      const uid = String(interaction.options.getString("user_id") || "").trim();
      c.banned = c.banned.filter(x => x !== uid);
      try {
        if (c.strikeBans && typeof c.strikeBans === "object") delete c.strikeBans[uid];
      } catch (e) {}
      await save();
      await interaction.editReply({ content: "Unbanned " + uid + " if they were banned." }).catch(() => {});
      return;
    }
    if (sub === "channel") {
      const action = interaction.options.getString("action");
      const target = interaction.options.getChannel("target");
      if (action === "show") {
        const list = c.channels.length ? c.channels.map(id => "<#" + id + ">").join("\n") : "No channels set.";
        await interaction.editReply({ content: "Confession channels:\n" + list }).catch(() => {});
        return;
      }
      if (!target) {
        await interaction.editReply({ content: "Pick a channel first." }).catch(() => {});
        return;
      }
      if (action === "add") {
        if (!c.channels.includes(target.id)) c.channels.push(target.id);
        await save();
        await interaction.editReply({ content: "<#" + target.id + "> added as confession channel." }).catch(() => {});
        return;
      }
      c.channels = c.channels.filter(x => x !== target.id);
      await save();
      await interaction.editReply({ content: "<#" + target.id + "> removed." }).catch(() => {});
      return;
    }
    if (sub === "review") {
      c.review = interaction.options.getString("mode") === "on";
      await save();
      await interaction.editReply({ content: "Review mode is now " + (c.review ? "ON. New confessions need approval via /confess queue." : "OFF. Confessions post instantly.") }).catch(() => {});
      return;
    }
    if (sub === "color") {
      let hex = String(interaction.options.getString("hex") || "").trim();
      if (hex[0] !== "#") hex = "#" + hex;
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) {
        await interaction.editReply({ content: "Use a hex color like #9B59B6." }).catch(() => {});
        return;
      }
      c.color = hex.toUpperCase();
      await save();
      await interaction.editReply({ content: "Embed color set to " + c.color + "." }).catch(() => {});
      return;
    }
    if (sub === "logs") {
      c.logs = interaction.options.getString("mode") === "on";
      await save();
      await interaction.editReply({ content: "Author logging is now " + (c.logs ? "ON. Users are told via /confess checklogs." : "OFF.") }).catch(() => {});
      return;
    }
  }
});
cmd.handleComponent = handleComponent;
cmd.handleModal = handleModal;
export default cmd;
export { handleComponent, handleModal };
