const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "new_session",
  description: "Start new Gemini conversation (clear history)",
  async execute(interaction) {
    const gemini = global.scraper.gemini;
    if (gemini) gemini.clearSession(interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor("#57F287")
      .setDescription("New session started. Conversation history cleared.")
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: 64 });
  }
};
