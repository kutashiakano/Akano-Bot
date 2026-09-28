import { defineBot as define } from "@kutashiakanocanzy/sdk";
import database from "../../../../database/index.js";

function getCfg(gid) {
  const db = database.get();
  if (!db.discord.servers[gid]) database.ensureDiscord(db, {
    guildId: gid,
    guild: {
      name: ""
    }
  });
  const s = db.discord.servers[gid];
  if (!s.welcome) s.welcome = {
    enabled: false,
    channelId: null,
    message: "Welcome {user} to **{server}**! You are member #{count}",
    autoRoleId: null,
    goodbyeEnabled: true,
    goodbyeMessage: "**{user}** left the server",
    cardTitle: "WELCOME",
    cardCaption: "Member #{count} of {server}"
  };
  return s.welcome;
}

async function renderWelcomeCard(member, count, cfg) {
  try {
    const { cards } = await import("@kutashiakanocanzy/sdk");
    return await cards.welcome(member?.displayName || member?.user?.username || "User", member?.guild?.name || "Server", Number(count) || 0);
  } catch { return null; }
}

async function renderGoodbyeCard(member, count) {
  try {
    const { cards } = await import("@kutashiakanocanzy/sdk");
    return await cards.goodbye(member?.displayName || member?.user?.username || "User", member?.guild?.name || "Server", Number(count) || 0);
  } catch { return null; }
}

let boundGuilds = new Set;

function bindEvents(client) {
  client.on("guildMemberAdd", async member => {
    try {
      const cfg = getCfg(member.guild.id);
      if (!cfg.enabled) return;
      const count = member.guild.memberCount;
      if (cfg.autoRoleId) {
        try {
          await member.roles.add(cfg.autoRoleId);
        } catch {}
      }
      const ch = member.guild.channels.cache.get(cfg.channelId) || await client.channels.fetch(cfg.channelId).catch(() => null);
      if (!ch) return;
      const card = await renderWelcomeCard(member, count, cfg).catch(() => null);
      const text = cfg.message.replaceAll("{user}", `<@${member.user.id}>`).replaceAll("{server}", member.guild.name).replaceAll("{count}", String(count));
      const payload = {
        content: text
      };
      if (card) payload.files = [ {
        attachment: card,
        name: "welcome.png"
      } ];
      await ch.send(payload).catch(() => {});
    } catch (e) {
      global.logError("welcome.join", e);
    }
  });
  client.on("guildMemberRemove", async member => {
    try {
      const cfg = getCfg(member.guild?.id);
      if (!cfg.enabled || !cfg.goodbyeEnabled) return;
      const ch = member.guild.channels.cache.get(cfg.channelId) || await client.channels.fetch(cfg.channelId).catch(() => null);
      if (!ch) return;
      const text = cfg.goodbyeMessage.replaceAll("{user}", `<@${member.user?.id || "?"}>`).replaceAll("{server}", member.guild.name).replaceAll("{count}", String(member.guild.memberCount));
      const card = await renderGoodbyeCard(member, member.guild.memberCount).catch(() => null);
      const payload = { content: text };
      if (card) payload.files = [ { attachment: card, name: "goodbye.png" } ];
      await ch.send(payload).catch(() => {});
    } catch (e) {
      global.logError("welcome.leave", e);
    }
  });
  boundGuilds.add(client.user?.id || "default");
}

async function setup(client) {
  try {
    const db = database.get();
    const servers = db.discord?.servers || {};
    const anyEnabled = Object.values(servers).some(s => s.welcome?.enabled);
    if (anyEnabled && !boundGuilds.has(client.user?.id || "default")) bindEvents(client);
  } catch (e) {
    global.logError("welcome.setup", e);
  }
}

export default define({
  name: [ "welcome" ],
  category: "tools",
  description: "Welcome card canvas + goodbye + autorole on member join",
  setup: setup,
  options: [ {
    name: "channel",
    type: 7,
    description: "Channel for welcome messages",
    required: false
  }, {
    name: "enabled",
    type: 5,
    description: "Turn welcome on/off",
    required: false
  }, {
    name: "autorole",
    type: 8,
    description: "Role given automatically on join",
    required: false
  }, {
    name: "goodbye",
    type: 5,
    description: "Toggle goodbye message",
    required: false
  }, {
    name: "title",
    type: 3,
    description: "Card title text (max 22 chars)",
    required: false
  }, {
    name: "caption",
    type: 3,
    description: "Card caption, vars: {user} {server} {count}",
    required: false
  } ],
  run: async ctx => {
    const i = ctx.interaction;
    await i.deferReply({
      flags: 64
    }).catch(() => {});
    const gid = i.guildId;
    const cfg = getCfg(gid);
    const channel = i.options.getChannel("channel");
    const enabled = i.options.getBoolean("enabled");
    const autorole = i.options.getRole("autorole");
    const goodbye = i.options.getBoolean("goodbye");
    const title = i.options.getString("title");
    const caption = i.options.getString("caption");
    if (channel) cfg.channelId = channel.id;
    if (typeof enabled === "boolean") cfg.enabled = enabled;
    if (autorole) cfg.autoRoleId = autorole.id;
    if (typeof goodbye === "boolean") cfg.goodbyeEnabled = goodbye;
    if (title) cfg.cardTitle = title.slice(0, 22);
    if (caption) cfg.cardCaption = caption.slice(0, 120);
    try {
      database.write(database.get());
    } catch {}
    if ((enabled === true || cfg.enabled) && !boundGuilds.has(i.client.user?.id || "default")) bindEvents(i.client);
    const previewCard = await renderWelcomeCard({
      user: i.user,
      guild: i.guild
    }, i.guild?.memberCount || 1, cfg).catch(() => null);
    const embed = (new i.client.ebuilder).setColor("#5865F2").setTitle("Welcome Config").setDescription([ `Status: ${cfg.enabled ? "ON" : "OFF"}`, `Canvas: ${canvas.available ? canvas.fontOk ? "native + font OK" : "native (system font)" : "unavailable"}`, `Channel: ${cfg.channelId ? `<#${cfg.channelId}>` : "not set"}`, `AutoRole: ${cfg.autoRoleId ? `<@&${cfg.autoRoleId}>` : "none"}`, `Goodbye: ${cfg.goodbyeEnabled ? "ON" : "OFF"}`, `Title: \`${cfg.cardTitle}\``, `Caption: \`${cfg.cardCaption}\``, "", "Vars: {user} {server} {count}" ].join("\n"));
    if (previewCard) embed.setImage("attachment://preview.png");
    const payload = {
      embeds: [ embed ]
    };
    if (previewCard) payload.files = [ {
      attachment: previewCard,
      name: "preview.png"
    } ];
    return i.editReply(payload).catch(() => {});
  }
});