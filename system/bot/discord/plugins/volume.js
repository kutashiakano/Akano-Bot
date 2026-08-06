const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "volume",
  description: "Set music volume (1-200)",
  options: [
    {
      name: "level",
      type: 4,
      description: "Volume level (1-200, default 100)",
      required: true,
      min_value: 1,
      max_value: 200
    }
  ],
  async execute(interaction) {
    try { await interaction.deferReply(); } catch (e) { return; }

    const playCmd = global.discordCommands["p"];
    const queues = playCmd?.getQueues?.();
    const queue = queues?.get(interaction.guildId);

    if (!queue || !queue.currentSong) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ED4245")
            .setDescription("No music is currently playing.")
        ]
      });
    }

    const level = interaction.options.getInteger("level");
    const volumeFloat = level / 100;

    queue.volume = volumeFloat;
    if (queue.currentResource?.volume) {
      queue.currentResource.volume.setVolume(volumeFloat);
    }

    const bar = buildVolumeBar(level);

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor("#57F287")
          .setTitle("Volume Set")
          .setDescription(`${bar} \`${level}%\``)
      ]
    });
  }
};

function buildVolumeBar(level, length = 10) {
  const filled = Math.round((level / 200) * length);
  return "█".repeat(filled) + "░".repeat(length - filled);
}
