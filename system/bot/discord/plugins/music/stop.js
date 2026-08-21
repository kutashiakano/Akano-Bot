const { clearQ } = require("./engine");


const { define } = require("../../../plugin");

module.exports = define({
  name: ["stop"],
  category: "music",
  description: "Stop music and leave the voice channel",
  options: [],
  run: async (ctx) => {
    const interaction = ctx.interaction;

    try {
      await interaction.deferReply();
    } catch (e) {
      return;
    }

    const playCmd = global.discordCommands["p"];
    const queues = playCmd?.getQueues?.();
    const queue = queues?.get(interaction.guildId);

    if (!queue) {
      return interaction.editReply({
        embeds: [
          new (interaction.client.ebuilder)().setColor("#ED4245").setDescription("No music is currently playing."),
        ],
      });
    }

    const songCount = queue.songs.length;
    const currentTitle = queue.currentSong?.title || "Unknown";

    await clearQ(interaction.guildId);

    await interaction.editReply({
      embeds: [
        new (interaction.client.ebuilder)()
          .setColor("#ED4245")
          .setTitle("Music Stopped")
          .setDescription(
            `Stopped playing **${currentTitle}** and ${songCount} other songs in the queue.`,
          )
          .setFooter({ text: `Requested by ${interaction.user.username}` }),
      ],
    });
  
  },
});
