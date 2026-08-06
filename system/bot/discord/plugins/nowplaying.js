const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "np",
  description: "Show info about the currently playing song",
  options: [],
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

    const song = queue.currentSong;
    const resource = queue.currentResource;
    const elapsed = resource ? Math.floor(resource.playbackDuration / 1000) : 0;
    const total = song.duration || 0;

    const bar = buildProgressBar(elapsed, total);

    const embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTitle("Now Playing")
      .setDescription(`[${song.title}](${song.url})`)
      .setThumbnail(song.thumbnail || null)
      .addFields(
        { name: "Progress", value: `\`${formatDuration(elapsed)}\` ${bar} \`${formatDuration(total)}\``, inline: false },
        { name: "Artist", value: song.uploader, inline: true },
        { name: "Requester", value: song.requester, inline: true },
        { name: "Status", value: queue.paused ? "**Paused**" : "**Playing**", inline: true }
      );

    await interaction.editReply({ embeds: [embed] });
  }
};

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function buildProgressBar(current, total, length = 14) {
  if (!total || total === 0) return "▬".repeat(length);
  const progress = Math.min(Math.floor((current / total) * length), length - 1);
  return "▬".repeat(progress) + "🔘" + "▬".repeat(length - progress - 1);
}
