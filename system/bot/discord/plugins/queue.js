const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "queue",
  description: "Show the current music queue",
  options: [
    {
      name: "page",
      type: 4,
      description: "Queue page (default: 1)",
      required: false
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

    const page = Math.max(1, interaction.options.getInteger("page") || 1);
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(queue.songs.length / pageSize));
    const actualPage = Math.min(page, totalPages);
    const start = (actualPage - 1) * pageSize;
    const end = start + pageSize;

    const songList = queue.songs.slice(start, end)
      .map((s, i) => `\`${start + i + 1}.\` ${s.title} \`${formatDuration(s.duration)}\` — ${s.requester}`)
      .join("\n") || "*No songs in queue*";

    const totalDuration = queue.songs.reduce((acc, s) => acc + (s.duration || 0), 0);

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle(`Queue — ${interaction.guild.name}`)
      .setDescription(
        `**Now Playing:**\n[${queue.currentSong.title}](${queue.currentSong.url}) \`${formatDuration(queue.currentSong.duration)}\`\n\n**Queue:**\n${songList}`
      )
      .addFields(
        { name: "Total Songs", value: `\`${queue.songs.length}\``, inline: true },
        { name: "Total Duration", value: `\`${formatDuration(totalDuration)}\``, inline: true },
        { name: "Volume", value: `\`${Math.round((queue.volume || 1) * 100)}%\``, inline: true }
      )
      .setFooter({ text: `Page ${actualPage}/${totalPages}` });

    await interaction.editReply({ embeds: [embed] });
  }
};

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
