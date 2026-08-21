
const { formatDuration, bar } = require("./utils");


const { define } = require("../../../plugin");

module.exports = define({
  name: ["np"],
  category: "tools",
  help: "Show info about the currently playing song",
  options: [],
  run: async (ctx) => {
    const interaction = ctx.interaction;
    
        const { EmbedBuilder } = interaction.client;
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
            embeds: [
              new EmbedBuilder().setColor("#ED4245").setDescription("No music is currently playing."),
            ],
          });
        }
    
        const song = queue.currentSong;
        const resource = queue.currentResource;
        const elapsed = resource ? Math.floor(resource.playbackDuration / 1000) : 0;
        const total = song.duration || 0;
    
        const bar = bar(elapsed, total);
    
        const embed = new EmbedBuilder()
          .setColor("#5865F2")
          .setTitle("Now Playing")
          .setDescription(`[${song.title}](${song.url})`)
          .setThumbnail(song.thumbnail || null)
          .addFields(
            {
              name: "Progress",
              value: `\`${formatDuration(elapsed)}\` ${bar} \`${formatDuration(total)}\``,
              inline: false,
            },
            { name: "Artist", value: song.uploader, inline: true },
            { name: "Requester", value: song.requester, inline: true },
            { name: "Status", value: queue.paused ? "**Paused**" : "**Playing**", inline: true },
          );
    
        await interaction.editReply({ embeds: [embed] });
  },
});
