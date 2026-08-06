const { EmbedBuilder, ChannelType } = require("discord.js");

module.exports = {
  name: "serverinfo",
  description: "Show full server information",
  options: [],
  async execute(interaction) {
    try { await interaction.deferReply(); } catch (e) { return; }

    const guild = interaction.guild;
    await guild.fetch();

    const members = await guild.members.fetch();
    const humans = members.filter(m => !m.user.bot).size;
    const bots = members.filter(m => m.user.bot).size;

    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildVoice).size;
    const categories = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).size;

    const verificationLevels = { 0: "None", 1: "Low", 2: "Medium", 3: "High", 4: "Very High" };
    const boostTiers = { 0: "None", 1: "Tier 1", 2: "Tier 2", 3: "Tier 3" };

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle(guild.name)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 256 }) || null)
      .setImage(guild.bannerURL({ size: 1024 }) || null)
      .addFields(
        { name: "Owner", value: `<@${guild.ownerId}>`, inline: true },
        { name: "ID", value: `\`${guild.id}\``, inline: true },
        { name: "Created", value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
        { name: "Members", value: `Total: **${guild.memberCount}**\nManusia: **${humans}** | Bot: **${bots}**`, inline: true },
        { name: "Channels", value: `Text: **${textChannels}**\nVoice: **${voiceChannels}**\nCategories: **${categories}**`, inline: true },
        { name: "Roles", value: `**${guild.roles.cache.size}** roles`, inline: true },
        { name: "Boost", value: `${boostTiers[guild.premiumTier]} (${guild.premiumSubscriptionCount} boosts)`, inline: true },
        { name: "Verification", value: verificationLevels[guild.verificationLevel], inline: true },
        { name: "Emoji", value: `**${guild.emojis.cache.size}** emoji`, inline: true }
      )
      .setFooter({ text: `Requested by ${interaction.user.username}` })
      .setTimestamp();

    if (guild.description) {
      embed.setDescription(guild.description);
    }

    await interaction.editReply({ embeds: [embed] });
  }
};
