
const { createVolumeBar, formatDuration } = require("./utils");
const { svState } = require("./state");


const { define } = require("../../../plugin");

module.exports = define({
  name: ["volume"],
  category: "music",
  help: "Set music volume (1-100)",
  options: [
    {
      name: "level",
      type: 4,
      description: "Volume level (1-100, default 100)",
      required: true,
      min_value: 1,
      max_value: 100,
    },
  ],
  run: async (ctx) => {
    const interaction = ctx.interaction;
        try {
          await interaction.deferReply();
        } catch {
          return;
        }
        const playCmd = global.discordCommands["p"];
        const queues = playCmd?.getQueues?.();
        const queue = queues?.get(interaction.guildId);
        if (!queue || !queue.currentSong) {
          return interaction.editReply({
            embeds: [
              new (interaction.client.ebuilder)().setColor("#ED4245").setDescription("No music is currently playing."),
            ],
          });
        }
        const level = interaction.options.getInteger("level");
        const volumeFloat = Math.min(1, Math.max(0, level / 100));
        queue.volume = volumeFloat;
        if (queue.currentResource?.volume) {
          queue.currentResource.volume.setVolume(volumeFloat);
        }
        svState(interaction.guildId, queue);
        const bar = createVolumeBar(level);
        await interaction.editReply({
          embeds: [
            new (interaction.client.ebuilder)()
              .setColor("#57F287")
              .setTitle("Volume Set")
              .setDescription(`${bar} \`${level}%\``),
          ],
        });
  },
});
