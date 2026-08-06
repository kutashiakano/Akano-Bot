const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");

const CATEGORIES = [
  {
    id: "music",
    label: "Music",
    color: "#5865F2",
    commands: [
      { name: "/p", desc: "Play a song from Spotify/YouTube (URL or title)" },
      { name: "/skip", desc: "Skip the currently playing song" },
      { name: "/stop", desc: "Stop music and leave voice channel" },
      { name: "/queue", desc: "View the current song queue" },
      { name: "/np", desc: "View currently playing song + progress bar" },
      { name: "/volume", desc: "Set music volume (1-200)" }
    ]
  },
  {
    id: "tools",
    label: "Tools",
    color: "#FEE75C",
    commands: [
      { name: "/dl", desc: "Download media from YouTube, TikTok, Instagram, X, FB, Spotify, Pinterest" },
      { name: "/ai", desc: "Chat with Gemini AI" }
    ]
  },
  {
    id: "moderation",
    label: "Moderation",
    color: "#ED4245",
    commands: [
      { name: "/mod kick", desc: "Kick a member from the server" },
      { name: "/mod ban", desc: "Ban a member from the server" },
      { name: "/mod unban", desc: "Unban a user from the server" },
      { name: "/mod timeout", desc: "Timeout a member (temporary mute)" },
      { name: "/mod untimeout", desc: "Remove timeout from a member" },
      { name: "/mod clear", desc: "Delete a certain amount of messages" },
      { name: "/mod warn", desc: "Issue a warning to a member" },
      { name: "/mod warnings", desc: "View warning history of a member" },
      { name: "/mod slowmode", desc: "Set channel slowmode" },
      { name: "/mod lock", desc: "Lock channel (no one can send messages)" },
      { name: "/mod unlock", desc: "Unlock channel" }
    ]
  },
  {
    id: "info",
    label: "Info",
    color: "#57F287",
    commands: [
      { name: "/serverinfo", desc: "Full server info (members, channels, boosts, etc)" },
      { name: "/userinfo", desc: "Detailed user info (join date, roles, avatar)" },
      { name: "/announce", desc: "Send an announcement to a specific channel" },
      { name: "/poll", desc: "Create a poll with vote buttons" }
    ]
  }
];

function buildCategoryEmbed(cat) {
  const cmdList = cat.commands
    .map(c => `\`${c.name}\` — ${c.desc}`)
    .join("\n");

  return new EmbedBuilder()
    .setColor(cat.color)
    .setTitle(cat.label)
    .setDescription(cmdList)
    .setFooter({ text: `${global.botname} - Discord Edition` });
}

function buildHomeEmbed(client) {
  const totalCmds = CATEGORIES.reduce((a, c) => a + c.commands.length, 0);
  return new EmbedBuilder()
    .setColor("#5865F2")
    .setTitle(`${global.botname} - Main Menu`)
    .setThumbnail(client?.user?.displayAvatarURL({ dynamic: true }) || null)
    .setDescription(
      "Multi-function bot for your Discord server.\nSelect a category below to view commands."
    )
    .addFields(
      { name: "Total Commands", value: `\`${totalCmds}\` commands`, inline: true },
      { name: "Prefix", value: "`/` (Slash Command)", inline: true },
      { name: "Categories", value: CATEGORIES.map(c => c.label).join("\n"), inline: false }
    )
    .setFooter({ text: `${global.botname} - Made by Canzy` })
    .setTimestamp();
}

function buildRow(activeCatId = null) {
  const buttons = CATEGORIES.map(cat =>
    new ButtonBuilder()
      .setCustomId(`menu_cat_${cat.id}`)
      .setLabel(cat.label)
      .setStyle(activeCatId === cat.id ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  const rows = [];
  for (let i = 0; i < buttons.length; i += 4) {
    rows.push(new ActionRowBuilder().addComponents(...buttons.slice(i, i + 4)));
  }
  return rows;
}

module.exports = {
  name: "menu",
  description: "Show menu and list of all bot commands",
  options: [],
  async execute(interaction) {
    try {
      await interaction.deferReply();
    } catch (e) {
      return;
    }

    const client = global.discord;
    const message = await interaction.editReply({
      embeds: [buildHomeEmbed(client)],
      components: buildRow()
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 120000
    });

    collector.on("collect", async (btn) => {
      if (!btn.customId.startsWith("menu_cat_")) return;
      await btn.deferUpdate().catch(() => {});

      const catId = btn.customId.replace("menu_cat_", "");
      const cat = CATEGORIES.find(c => c.id === catId);

      if (!cat) return;

      await message.edit({
        embeds: [buildCategoryEmbed(cat)],
        components: buildRow(catId)
      }).catch(() => {});
    });

    collector.on("end", async () => {
      try {
        await message.edit({ components: [] });
      } catch (e) {}
    });
  }
};