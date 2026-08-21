const database = require("../../../../database");

async function view(interaction) {
  await interaction.deferReply().catch(() => {});

  const guild = interaction.guild;
  await guild.fetch().catch(() => {});

  let humans = null;
  let bots = null;
  try {
    const members = await guild.members.fetch();
    humans = members.filter((m) => !m.user.bot).size;
    bots = members.filter((m) => m.user.bot).size;
  } catch (e) {}

  const textChannels = guild.channels.cache.filter((c) => c.type === interaction.client.ChannelType.GuildText).size;
  const voiceChannels = guild.channels.cache.filter((c) => c.type === interaction.client.ChannelType.GuildVoice).size;
  const categories = guild.channels.cache.filter((c) => c.type === interaction.client.ChannelType.GuildCategory).size;

  const verificationLevels = { 0: "None", 1: "Low", 2: "Medium", 3: "High", 4: "Very High" };
  const boostTiers = { 0: "None", 1: "Tier 1", 2: "Tier 2", 3: "Tier 3" };

  const embed = new (interaction.client.ebuilder)()
    .setColor("#5865F2")
    .setTitle(guild.name)
    .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }) || null)
    .setImage(guild.bannerURL({ size: 1024 }) || null)
    .addFields(
      { name: "Owner", value: `<@${guild.ownerId}>`, inline: true },
      { name: "ID", value: `\`${guild.id}\``, inline: true },
      {
        name: "Created",
        value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`,
        inline: true,
      },
      {
        name: "Members",
        value:
          humans !== null
            ? `Total: **${guild.memberCount}**\nManusia: **${humans}** | Bot: **${bots}**`
            : `Total: **${guild.memberCount}**`,
        inline: true,
      },
      {
        name: "Channels",
        value: `Text: **${textChannels}**\nVoice: **${voiceChannels}**\nCategories: **${categories}**`,
        inline: true,
      },
      { name: "Roles", value: `**${guild.roles.cache.size}** roles`, inline: true },
      {
        name: "Boost",
        value: `${boostTiers[guild.premiumTier]} (${guild.premiumSubscriptionCount} boosts)`,
        inline: true,
      },
      { name: "Verification", value: verificationLevels[guild.verificationLevel], inline: true },
      { name: "Emoji", value: `**${guild.emojis.cache.size}** emoji`, inline: true },
    )
    .setFooter({ text: `Requested by ${interaction.user.username}` })
    .setTimestamp();

  if (guild.description) {
    embed.setDescription(guild.description);
  }

  const isAdmin = Boolean(
    interaction.member?.permissions?.has("ManageGuild") ||
      interaction.member?.permissions?.has("Administrator"),
  );

  if (isAdmin) {
    const guildId = interaction.guildId;
    const db = database.get();
    const settings = db.discord?.servers?.[guildId]?.settings || {};

    const disabledPlugins = db.settings?.disabledPlugins?.discord || [];
    const errLine = disabledPlugins.length
      ? disabledPlugins.map((n) => "`" + n + "`").join(", ")
      : "None — all commands healthy";

    let nickLine = "`" + global.botname + "` (default)";
    let bioLine = "Not set";
    try {
      if (interaction.guild?.members?.me?.nick) {
        nickLine = "`" + interaction.guild.members.me.nick + "` (custom)";
      }
    } catch (e) {}
    if (settings.nick) {
      nickLine = "`" + settings.nick + "` (custom)";
    }
    if (settings.bio) {
      bioLine = "> " + settings.bio;
    } else {
      try {
        const me = await interaction.client.rest.get("/users/@me");
        if (me?.bio) bioLine = "> " + me.bio + " *(global)*";
      } catch (e) {}
    }

    embed.addFields(
      { name: "Commands Disabled Due To Errors", value: errLine, inline: true },
      { name: "Bot Nickname (this server)", value: nickLine, inline: true },
      { name: "Bot Bio (this server)", value: bioLine, inline: true },
    );
  }

  await interaction.editReply({ embeds: [embed] }).catch(() => {});
}

const __orig = {
  name: "status",
  description: "Server info (owner, members, channels) + bot settings for admins",
  options: [],
  execute: view,
  view,
}
const { define } = require("../../../plugin");

module.exports = define({
  name: Array.isArray(__orig.name) ? __orig.name : [__orig.name || "unnamed"],
  category: "tools",
  help: "Server info (owner, members, channels) + bot settings for admins",
  options: Array.isArray(__orig.options) ? __orig.options : [],
  run: async function (c) { return __orig.execute.call(__orig, c.interaction); },
});
