const { define } = require("../../../plugin");
const database = require("../../../../database");

function getStore(gid) {
  const db = database.get();
  if (!db.discord.servers[gid]) database.ensureDiscord(db, { guildId: gid, guild: { name: "" } });
  const s = db.discord.servers[gid];
  if (!s.polls) s.polls = {};
  return s.polls;
}

module.exports = define({
  name: ["poll"],
  category: "tools",
  description: "Poll Forge — scheduled poll with auto close",
  options: [
    { name: "question", type: 3, description: "Poll question", required: true },
    { name: "duration", type: 3, description: "10m/1h/1d/7d", required: false },
    { name: "option1", type: 3, description: "Option 1", required: true },
    { name: "option2", type: 3, description: "Option 2", required: true },
    { name: "option3", type: 3, description: "Option 3", required: false },
    { name: "option4", type: 3, description: "Option 4", required: false },
  ],
  run: async (ctx) => {
    const i = ctx.interaction;
    const q = i.options.getString("question");
    const durStr = i.options.getString("duration") || "1d";
    const map = { "10m": 600000, "1h": 3600000, "1d": 86400000, "7d": 604800000 };
    const dur = map[durStr] || 86400000;
    const opts = [1, 2, 3, 4].map((n) => i.options.getString(`option${n}`)).filter(Boolean).slice(0, 10);
    if (opts.length < 2) return i.reply({ content: "Need at least 2 options.", flags: 64 });
    const id = Math.random().toString(36).slice(2, 6);
    const endsAt = Date.now() + dur;
    const row = new (i.client.abuilder)();
    opts.forEach((o, idx) => row.addComponents(new (i.client.bbuilder)().setCustomId(`poll_${id}_${idx}`).setLabel(o.slice(0, 80)).setStyle(i.client.ButtonStyle.Secondary)));
    const embed = new (i.client.ebuilder)().setColor("#5865F2").setTitle(`📊 ${q}`).setDescription(opts.map((o, idx) => `\`${idx + 1}.\` ${o} — 0 votes`).join("\n")).setFooter({ text: `Poll ${id} • Ends <t:${Math.floor(endsAt / 1000)}:R> • 0 votes` });
    const msg = await i.reply({ embeds: [embed], components: [row], fetchReply: true });
    const store = getStore(i.guildId);
    store[id] = { question: q, options: opts, channelId: i.channelId, messageId: msg.id, endsAt, votes: {}, closed: false };
    database.write(database.get());
    setTimeout(async () => {
      const db = database.get();
      const p = db.discord.servers[i.guildId]?.polls?.[id];
      if (!p || p.closed) return;
      p.closed = true;
      database.write(db);
      const counts = opts.map((_, idx) => Object.values(p.votes).filter((v) => v === idx).length);
      const total = Object.keys(p.votes).length;
      const lines = opts.map((o, idx) => {
        const c = counts[idx];
        const pct = total ? Math.round((c / total) * 100) : 0;
        const bar = "▓".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
        return `${bar} ${pct}% — ${o} (${c})`;
      }).join("\n");
      const res = new (i.client.ebuilder)().setColor("#57F287").setTitle(`📊 Results: ${q}`).setDescription(lines).setFooter({ text: `Poll ${id} closed • ${total} voters` });
      try { const ch = await i.guild.channels.fetch(p.channelId).catch(() => null); if (ch) await ch.send({ embeds: [res] }); } catch {}
      try { const ch2 = await i.client.channels.fetch(p.channelId).catch(() => null); const m = ch2 ? await ch2.messages.fetch(p.messageId).catch(() => null) : null; if (m) { const dis = row.components.map((c) => c.setDisabled(true)); await m.edit({ components: [new (i.client.abuilder)().addComponents(dis)] }).catch(() => {}); } } catch {}
    }, dur);
    return;
  },
});
