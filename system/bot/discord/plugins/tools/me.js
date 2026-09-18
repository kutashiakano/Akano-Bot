const database = require("../../../../database");
const { define: define } = require("../../../sdk");

module.exports = define({
  name: [ "me", "profile" ],
  category: "tools",
  description: "Show user profile card",
  options: [ {
    name: "user",
    type: 6,
    description: "User to view (default: yourself)",
    required: false
  } ],
  run: async ctx => {
    const interaction = ctx.interaction;
    const { EmbedBuilder: EmbedBuilder } = interaction.client;
    try {
      await interaction.deferReply();
    } catch {
      return;
    }
    const target = interaction.options.getUser("user") || interaction.user;
    let extra = {};
    try {
      extra = database.get().discord?.users?.[target.id] || {};
    } catch {}
    const card = ctx.fmt.userCard("dc", {
      name: target.username,
      id: target.id,
      username: target.username + (target.discriminator !== "0" ? "#" + target.discriminator : ""),
      accountCreated: new Date(target.createdTimestamp).toLocaleDateString(),
      bot: !!target.bot,
      registered: !!extra.registered,
      premium: false,
      expired: "-",
      footer: global.botname || ""
    });
    const embed = (new EmbedBuilder).setColor("#5865F2").setThumbnail(target.displayAvatarURL({
      dynamic: true,
      size: 256
    })).setDescription(card).setTimestamp();
    await interaction.editReply({
      embeds: [ embed ]
    }).catch(() => {});
  }
});
