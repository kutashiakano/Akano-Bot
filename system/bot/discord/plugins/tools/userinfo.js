const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "userinfo" ],
  category: "tools",
  description: "Show detailed user information",
  options: [ {
    name: "user",
    type: 6,
    description: "User to view info for (default: yourself)",
    required: false
  } ],
  run: async ctx => {
    const interaction = ctx.interaction;
    const {EmbedBuilder: EmbedBuilder} = interaction.client;
    try {
      await interaction.deferReply();
    } catch (e) {
      return;
    }
    const targetUser = interaction.options.getUser("user") || interaction.user;
    const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const statusMap = {
      online: "Online",
      idle: "Idle",
      dnd: "Do Not Disturb",
      offline: "Offline"
    };
    const roles = member ? member.roles.cache.filter(r => r.id !== interaction.guild.id).sort((a, b) => b.position - a.position).map(r => `<@&${r.id}>`).slice(0, 10).join(" ") || "None" : "N/A";
    const embed = (new EmbedBuilder).setColor(member?.displayHexColor || "#5865F2").setTitle(`${targetUser.username}${targetUser.discriminator !== "0" ? "#" + targetUser.discriminator : ""}`).setThumbnail(targetUser.displayAvatarURL({
      dynamic: true,
      size: 256
    })).addFields({
      name: "ID",
      value: `\`${targetUser.id}\``,
      inline: true
    }, {
      name: "Bot",
      value: targetUser.bot ? "Yes" : "No",
      inline: true
    }, {
      name: "Account Created",
      value: `<t:${Math.floor(targetUser.createdTimestamp / 1e3)}:D>`,
      inline: true
    });
    if (member) {
      embed.addFields({
        name: "Joined Server",
        value: `<t:${Math.floor(member.joinedTimestamp / 1e3)}:D>`,
        inline: true
      }, {
        name: "Nickname",
        value: member.nickname || "None",
        inline: true
      }, {
        name: "Boosting Since",
        value: member.premiumSince ? `<t:${Math.floor(member.premiumSinceTimestamp / 1e3)}:D>` : "Not boosting",
        inline: true
      }, {
        name: `Roles (${member.roles.cache.size - 1})`,
        value: roles,
        inline: false
      });
      if (member.displayAvatarURL() !== targetUser.displayAvatarURL()) {
        embed.setThumbnail(member.displayAvatarURL({
          dynamic: true,
          size: 256
        }));
      }
    }
    embed.setFooter({
      text: `Requested by ${interaction.user.username}`
    }).setTimestamp();
    await interaction.editReply({
      embeds: [ embed ]
    });
  }
});