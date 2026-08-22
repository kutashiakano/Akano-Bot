const { define } = require("../../../plugin");
const database = require("../../../../database");

function getConfig(guildId) {
  const db = database.get();
  if (!db.discord.servers[guildId]) database.ensureDiscord(db, { guildId, guild: { name: "" } });
  const s = db.discord.servers[guildId];
  if (!s.srr) s.srr = { roles: [] };
  return s.srr;
}

async function evaluate(member, cond) {
  const now = Date.now();
  if (cond.type === "account_age") return now - member.user.createdTimestamp >= cond.value;
  if (cond.type === "tenure") return now - member.joinedTimestamp >= cond.value;
  if (cond.type === "has_role") return member.roles.cache.has(cond.value);
  if (cond.type === "missing_role") return !member.roles.cache.has(cond.value);
  if (cond.type === "booster") return !!member.premiumSinceTimestamp;
  return false;
}

module.exports = define({
  name: ["srr"],
  category: "tools",
  description: "Smart Reaction Roles — conditional & scheduled",
  options: [
    { name: "action", type: 3, description: "create/list/delete", required: true, choices: [{ name: "create", value: "create" }, { name: "list", value: "list" }, { name: "delete", value: "delete" }] },
    { name: "message_id", type: 3, description: "Target message id", required: false },
    { name: "emoji", type: 3, description: "Emoji", required: false },
    { name: "role", type: 8, description: "Role to give", required: false },
  ],
  run: async (ctx) => {
    const i = ctx.interaction;
    const sub = i.options.getString("action");
    const gid = i.guildId;
    const cfg = getConfig(gid);
    if (sub === "list") {
      if (!cfg.roles.length) return i.reply({ content: "No SRR configured.", flags: 64 });
      const lines = cfg.roles.map((r) => `<:${r.emoji}> → <@&${r.roleId}> ${r.conditions.length} cond`).join("\n");
      return i.reply({ embeds: [new (i.client.ebuilder)().setColor("#5865F2").setTitle("SRR List").setDescription(lines)], flags: 64 });
    }
    if (sub === "create") {
      const msgId = i.options.getString("message_id");
      const emoji = i.options.getString("emoji");
      const role = i.options.getRole("role");
      if (!msgId || !emoji || !role) return i.reply({ content: "Need message_id, emoji, role.", flags: 64 });
      if (role.position >= i.guild.members.me.roles.highest.position) return i.reply({ content: "My role must be higher than target role.", flags: 64 });
      cfg.roles.push({ messageId: msgId, emoji, roleId: role.id, conditions: [], mode: "normal" });
      database.write(database.get());
      try { const ch = await i.guild.channels.fetch(i.channelId).catch(() => null); const msg = ch ? await ch.messages.fetch(msgId).catch(() => null) : null; if (msg) await msg.react(emoji).catch(() => {}); } catch {}
      return i.reply({ content: `SRR created: ${emoji} → ${role}`, flags: 64 });
    }
    if (sub === "delete") {
      const role = i.options.getRole("role");
      if (!role) return i.reply({ content: "Provide role to delete.", flags: 64 });
      cfg.roles = cfg.roles.filter((r) => r.roleId !== role.id);
      database.write(database.get());
      return i.reply({ content: `SRR for ${role} deleted.`, flags: 64 });
    }
  },
});
