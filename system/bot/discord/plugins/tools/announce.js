const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "announce" ],
  category: "tools",
  help: "Send an announcement to a specific channel",
  options: [ {
    name: "channel",
    type: 7,
    description: "Target announcement channel",
    required: true,
    channel_types: [ 0 ]
  }, {
    name: "title",
    type: 3,
    description: "Announcement title",
    required: true
  }, {
    name: "message",
    type: 3,
    description: "Announcement content",
    required: true
  }, {
    name: "ping",
    type: 8,
    description: "Role to ping (optional)",
    required: false
  }, {
    name: "color",
    type: 3,
    description: "Embed hex color (e.g.: #FF0000)",
    required: false
  } ],
  run: async ctx => {
    const interaction = ctx.interaction;
    const {EmbedBuilder: EmbedBuilder, PermissionFlagsBits: PermissionFlagsBits} = interaction.client;
    try {
      await interaction.deferReply({
        flags: 64
      });
    } catch (e) {
      return;
    }
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.editReply({
        embeds: [ (new EmbedBuilder).setColor("#ED4245").setDescription("You don't have permission to Manage Server.") ]
      });
    }
    const targetChannel = interaction.options.getChannel("channel");
    const title = interaction.options.getString("title");
    const message = interaction.options.getString("message");
    const role = interaction.options.getRole("ping");
    const colorInput = interaction.options.getString("color");
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    const color = colorInput && hexRegex.test(colorInput) ? colorInput : "#5865F2";
    const embed = (new EmbedBuilder).setColor(color).setTitle(title).setDescription(message).setFooter({
      text: `Announcement by ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL()
    }).setTimestamp();
    try {
      await targetChannel.send({
        content: role ? `<@&${role.id}>` : undefined,
        embeds: [ embed ]
      });
      await interaction.editReply({
        embeds: [ (new EmbedBuilder).setColor("#57F287").setDescription(`Announcement sent successfully to <#${targetChannel.id}>.`) ]
      });
    } catch (e) {
      await interaction.editReply({
        embeds: [ (new EmbedBuilder).setColor("#ED4245").setDescription(`Failed to send announcement: ${e.message}`) ]
      });
    }
  }
});