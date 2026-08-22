const { define } = require("../../../plugin");
const database = require("../../../../database");

function getCfg(gid) {
  const db = database.get();
  if (!db.discord.servers[gid]) database.ensureDiscord(db, { guildId: gid, guild: { name: "" } });
  const s = db.discord.servers[gid];
  if (!s.threadsteward) s.threadsteward = {};
  return s.threadsteward;
}

module.exports = define({
  name: ["threadsteward"],
  category: "tools",
  description: "Thread Steward — auto-archive & rename",
  options: [
    { name: "channel", type: 7, description: "Forum/text channel", required: true },
    { name: "archive", type: 3, description: "Auto archive: 1h/24h/3d/1w/off", required: false, choices: [{ name: "1h", value: "3600000" }, { name: "24h", value: "86400000" }, { name: "3d", value: "259200000" }, { name: "1w", value: "604800000" }, { name: "off", value: "0" }] },
    { name: "rename", type: 5, description: "Auto rename threads", required: false },
  ],
  run: async (ctx) => {
    const i = ctx.interaction;
    const ch = i.options.getChannel("channel");
    const archive = i.options.getString("archive");
    const rename = i.options.getBoolean("rename");
    const cfg = getCfg(i.guildId);
    if (!cfg.channels) cfg.channels = {};
    if (!cfg.channels[ch.id]) cfg.channels[ch.id] = {};
    if (archive) cfg.channels[ch.id].archiveMs = parseInt(archive, 10);
    if (typeof rename === "boolean") cfg.channels[ch.id].autoRename = rename;
    database.write(database.get());
    return i.reply({ embeds: [new (i.client.ebuilder)().setColor("#5865F2").setTitle("Thread Steward").setDescription(`Channel <#${ch.id}> → archive ${archive || "keep"} rename ${rename ?? "keep"}`)], flags: 64 });
  },
});
