const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "skip" ],
  category: "music",
  description: "Skip the currently playing song",
  options: [],
  run: async ctx => {
    const interaction = ctx.interaction;
    const {EmbedBuilder: EmbedBuilder} = interaction.client;
    try {
      await interaction.deferReply();
    } catch (e) {
      return;
    }
    const playCmd = global.discordCommands["p"];
    const queues = playCmd?.getQueues?.();
    const queue = queues?.get(interaction.guildId);
    if (!queue || !queue.currentSong) {
      return interaction.editReply({
        embeds: [ (new EmbedBuilder).setColor("#ED4245").setDescription("No music is currently playing.") ]
      });
    }
    const skippedTitle = queue.currentSong.title;
    queue.player.stop();
    await interaction.editReply({
      embeds: [ (new EmbedBuilder).setColor("#FEE75C").setDescription(`Skipped **${skippedTitle}**.`).setFooter({
        text: `Requested by ${interaction.user.username}`
      }) ]
    });
  }
});