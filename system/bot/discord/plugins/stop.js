const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "stop",
  description: "Stop music and leave the voice channel",
  options: [],
  async execute(interaction) {
    try { await interaction.deferReply(); } catch (e) { return; }

    const playCmd = global.discordCommands["p"];
    const queues = playCmd?.getQueues?.();
    const queue = queues?.get(interaction.guildId);

    if (!queue) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ED4245")
            .setDescription("No music is currently playing.")
        ]
      });
    }

    const songCount = queue.songs.length;
    const currentTitle = queue.currentSong?.title || "Unknown";

    queues.delete(interaction.guildId);
    if (queue.checkInterval) clearInterval(queue.checkInterval);
    if (queue.collector) queue.collector.stop();
    try { queue.player.stop(true); } catch (e) {}
    try { queue.connection.destroy(); } catch (e) {}
    if (queue.currentDir) {
      try { await global.scraper.ytdpl.cleanup(queue.currentDir); } catch (e) {}
    }
    if (queue.nextDir) {
      try { await global.scraper.ytdpl.cleanup(queue.nextDir); } catch (e) {}
    }

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor("#ED4245")
          .setTitle("Music Stopped")
          .setDescription(`Stopped playing **${currentTitle}** and ${songCount} other songs in the queue.`)
          .setFooter({ text: `Requested by ${interaction.user.username}` })
      ]
    });
  }
};
