function groupCommands() {
  const cmds = Object.values(global.discordCommands || {});
  const map = new Map();
  for (const c of cmds) {
    const cat = (c.category || c.tags?.[0] || "tools").toLowerCase();
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat).push(c);
  }
  for (const [k, v] of map) v.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return map;
}

function categoryEmoji(cat) {
  const m = {
    music: "🎵",
    tools: "🛠️",
    images: "🖼️",
    downloader: "⬇️",
    ai: "🤖",
    owner: "👑",
    moderation: "🛡️",
    utility: "🔧",
    fun: "🎮",
  };
  return m[cat] || "📦";
}

function helpEmbed(client, cat) {
  const map = groupCommands();
  const cats = [...map.keys()].sort();
  if (!cat) {
    const e = new (client.ebuilder)()
      .setColor("#5865F2")
      .setTitle("Feature Explorer")
      .setDescription(
        "Pick a category to explore commands.\n\n" +
          cats.map((c) => `${categoryEmoji(c)} **${c}** — ${map.get(c).length} command(s)`).join("\n")
      )
      .setFooter({ text: `${cats.length} categories • ${[...map.values()].flat().length} commands` });
    return e;
  }
  const list = map.get(cat) || [];
  const e = new (client.ebuilder)()
    .setColor("#5865F2")
    .setTitle(`${categoryEmoji(cat)} ${cat}`)
    .setDescription(
      list.length
        ? list
            .map((c) => {
              const name = Array.isArray(c.name) ? c.name[0] : c.name;
              const desc = (c.description || c.help || "No description").slice(0, 80);
              const opts = Array.isArray(c.options) && c.options.length ? ` \`${c.options.map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`)).join(" ")}\`` : "";
              return `**/${name}**${opts} — ${desc}`;
            })
            .join("\n")
        : "No commands."
    )
    .setFooter({ text: `/${cat} • ${list.length} command(s)` });
  return e;
}

function categoryRow(client, selected) {
  const map = groupCommands();
  const cats = [...map.keys()].sort().slice(0, 25);
  const menu = new (client.mbuilder)()
    .setCustomId("help_cat")
    .setPlaceholder("Choose a category")
    .addOptions(
      cats.map((c) => ({
        label: c,
        value: c,
        description: `${map.get(c).length} commands`,
        emoji: categoryEmoji(c),
      }))
    );
  return new (client.abuilder)().addComponents(menu);
}

function backRow(client) {
  return new (client.abuilder)().addComponents(
    new (client.bbuilder)().setCustomId("help_back").setLabel("Back").setStyle(client.ButtonStyle.Secondary)
  );
}

async function execute(interaction) {
  const embed = helpEmbed(interaction.client, null);
  const row = categoryRow(interaction.client, null);
  const msg = await interaction.reply({ embeds: [embed], components: [row], flags: 64 }).catch(() => null);
  if (!msg) return;
  const fetched = await interaction.fetchReply().catch(() => msg);
  const col = fetched.createMessageComponentCollector({
    filter: (i) => i.user.id === interaction.user.id,
    time: 120000,
  });
  col.on("collect", async (i) => {
    if (i.customId === "help_cat") {
      const cat = i.values?.[0];
      if (!cat) return i.deferUpdate().catch(() => {});
      const e = helpEmbed(i.client, cat);
      await i.update({ embeds: [e], components: [categoryRow(i.client, cat), backRow(i.client)] }).catch(() => {});
    } else if (i.customId === "help_back") {
      const e = helpEmbed(i.client, null);
      await i.update({ embeds: [e], components: [categoryRow(i.client, null)] }).catch(() => {});
    }
  });
  col.on("end", () => {
    fetched.edit({ components: [] }).catch(() => {});
  });
}

const { define } = require("../../../plugin");

module.exports = define({
  name: ["help"],
  category: "tools",
  description: "Feature explorer — browse all commands by category",
  options: [],
  run: async (ctx) => execute(ctx.interaction),
});
