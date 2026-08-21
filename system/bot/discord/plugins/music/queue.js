
const { formatDuration } = require("./utils");

function buildVolumeBar(percent) {
  const barLen = 15;
  const filled = Math.round((percent / 100) * barLen);
  return "▓".repeat(filled) + "░".repeat(barLen - filled) + ` ${percent}%`;
}


const { define } = require("../../../plugin");

module.exports = define({
  name: ["queue"],
  category: "tools",
  help: "Show the current music queue",
  options: [
    {
      name: "page",
      type: 4,
      description: "Queue page (default: 1)",
      required: false,
    },
  ],
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
    
        const page = Math.max(1, interaction.options.getInteger("page") || 1);
        const pageSize = 10;
        const totalPages = Math.max(1, Math.ceil(queue.songs.length / pageSize));
        const actualPage = Math.min(page, totalPages);
        const start = (actualPage - 1) * pageSize;
        const end = start + pageSize;
    
        const songList =
          queue.songs
            .slice(start, end)
            .map(
              (s, i) =>
                `\`${start + i + 1}.\` ${s.title} \`${formatDuration(s.duration)}\` — ${s.requester}`,
            )
            .join("\n") || "*No songs in queue*";
    
        const totalDuration = queue.songs.reduce((acc, s) => acc + (s.duration || 0), 0);
        const volumeBar = buildVolumeBar(Math.round((queue.volume || 1) * 100));
    
        const embed = new EmbedBuilder()
          .setColor("#5865F2")
          .setTitle(`Queue — ${interaction.guild.name}`)
          .setDescription(
            `**Now Playing:**\n[${queue.currentSong.title}](${queue.currentSong.url}) \`${formatDuration(queue.currentSong.duration)}\`\n\n**Queue:**\n${songList}`,
          )
          .addFields(
            { name: "Total Songs", value: `\`${queue.songs.length}\``, inline: true },
            { name: "Total Duration", value: `\`${formatDuration(totalDuration)}\``, inline: true },
            { name: "Volume", value: `\`${volumeBar}\``, inline: true },
          )
          .setFooter({ text: `Page ${actualPage}/${totalPages}` });
    
        await interaction.editReply({ embeds: [embed] });
  },
});
