const { define } = require("../../../plugin");
const database = require("../../../../database");

function getCfg(gid) {
  const db = database.get();
  if (!db.discord.servers[gid]) database.ensureDiscord(db, { guildId: gid, guild: { name: "" } });
  const s = db.discord.servers[gid];
  if (!s.vintage) s.vintage = { rules: [] };
  return s.vintage;
}

module.exports = define({
  name: ["vintage", "autorole"],
  category: "tools",
  description: "Tenure & Trust Auto-Role — account age & booster gate",
  options: [
    { name: "action", type: 3, description: "create/list/run", required: true, choices: [{ name: "create", value: "create" }, { name: "list", value: "list" }, { name: "run", value: "run" }] },
    { name: "trigger", type: 3, description: "account_age/server_tenure/booster", required: false, choices: [{ name: "account_age", value: "account_age" }, { name: "server_tenure", value: "server_tenure" }, { name: "booster", value: "booster" }] },
    { name: "days", type: 4, description: "Threshold days", required: false },
    { name: "role", type: 8, description: "Role", required: false },
  ],
  run: async (ctx) => {
    const i = ctx.interaction;
    const act = i.options.getString("action");
    const gid = i.guildId;
    const cfg = getCfg(gid);
    if (act === "list") {
      if (!cfg.rules.length) return i.reply({ content: "No vintage rules.", flags: 64 });
      const lines = cfg.rules.map((r, idx) => `\`${idx}\` ${r.trigger} >= ${r.days}d → <@&${r.roleId}>`).join("\n");
      return i.reply({ embeds: [new (i.client.ebuilder)().setColor("#5865F2").setTitle("Vintage Rules").setDescription(lines)], flags: 64 });
    }
    if (act === "create") {
      const trigger = i.options.getString("trigger");
      const days = i.options.getInteger("days");
      const role = i.options.getRole("role");
      if (!trigger || days == null || !role) return i.reply({ content: "Need trigger, days, role.", flags: 64 });
      cfg.rules.push({ trigger, days, roleId: role.id });
      database.write(database.get());
      return i.reply({ content: `Rule created: ${trigger} ${days}d → ${role}`, flags: 64 });
    }
    if (act === "run") {
      await i.deferReply({ flags: 64 });
      let added = 0;
      const members = await i.guild.members.fetch().catch(() => new Map());
      const jobs = [...members.values()].map(async (m) => {
        for (const r of cfg.rules) {
          let met = false;
          if (r.trigger === "account_age") met = Date.now() - m.user.createdTimestamp >= r.days * 86400000;
          if (r.trigger === "server_tenure") met = m.joinedTimestamp && Date.now() - m.joinedTimestamp >= r.days * 86400000;
          if (r.trigger === "booster") met = !!m.premiumSinceTimestamp;
          if (met && !m.roles.cache.has(r.roleId)) {
            try { await m.roles.add(r.roleId).catch(() => {}); added++; } catch {}
          }
        }
      });
      await Promise.all(jobs);
      return i.editReply({ content: `Vintage scan done — ${added} roles added.` });
    }
  },
});
