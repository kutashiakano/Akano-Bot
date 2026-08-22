const { define } = require("../../../plugin");
const database = require("../../../../database");

function getCfg(gid) {
  const db = database.get();
  if (!db.discord.servers[gid]) database.ensureDiscord(db, { guildId: gid, guild: { name: "" } });
  const s = db.discord.servers[gid];
  if (!s.gate) s.gate = {};
  return s.gate;
}

module.exports = define({
  name: ["gate"],
  category: "tools",
  description: "Gatekeeper — button verification with timed role",
  options: [
    { name: "action", type: 3, description: "setup/panel/verify", required: true, choices: [{ name: "setup", value: "setup" }, { name: "panel", value: "panel" }, { name: "verify", value: "verify" }] },
    { name: "channel", type: 7, description: "Verify channel", required: false },
    { name: "unverified", type: 8, description: "Unverified role", required: false },
    { name: "verified", type: 8, description: "Verified role", required: false },
    { name: "user", type: 6, description: "User to verify", required: false },
  ],
  run: async (ctx) => {
    const i = ctx.interaction;
    const act = i.options.getString("action");
    const cfg = getCfg(i.guildId);
    if (act === "setup") {
      const ch = i.options.getChannel("channel");
      const unv = i.options.getRole("unverified");
      const ver = i.options.getRole("verified");
      if (!ch || !unv || !ver) return i.reply({ content: "Need channel, unverified, verified.", flags: 64 });
      cfg.channelId = ch.id;
      cfg.unverifiedId = unv.id;
      cfg.verifiedId = ver.id;
      cfg.timeoutMs = 86400000;
      database.write(database.get());
      return i.reply({ content: `Gate setup: <#${ch.id}> ${unv} → ${ver}`, flags: 64 });
    }
    if (act === "panel") {
      if (!cfg.channelId) return i.reply({ content: "Run /gate setup first.", flags: 64 });
      const ch = await i.guild.channels.fetch(cfg.channelId).catch(() => null);
      if (!ch) return i.reply({ content: "Channel not found.", flags: 64 });
      const embed = new (i.client.ebuilder)().setColor("#5865F2").setTitle("Verification Required").setDescription("Click **Verify** to get access. You have 24h or you will be kicked if kick-on-timeout is enabled.");
      const row = new (i.client.abuilder)().addComponents(new (i.client.bbuilder)().setCustomId("gate_verify").setLabel("Verify").setStyle(i.client.ButtonStyle.Success));
      await ch.send({ embeds: [embed], components: [row] }).catch(() => {});
      return i.reply({ content: `Panel posted in <#${ch.id}>`, flags: 64 });
    }
    if (act === "verify") {
      const user = i.options.getUser("user");
      if (!user) return i.reply({ content: "Provide user.", flags: 64 });
      const m = await i.guild.members.fetch(user.id).catch(() => null);
      if (!m) return i.reply({ content: "Member not found.", flags: 64 });
      try {
        if (cfg.unverifiedId && m.roles.cache.has(cfg.unverifiedId)) await m.roles.remove(cfg.unverifiedId).catch(() => {});
        if (cfg.verifiedId) await m.roles.add(cfg.verifiedId).catch(() => {});
      } catch {}
      return i.reply({ content: `Verified ${user}`, flags: 64 });
    }
  },
});
