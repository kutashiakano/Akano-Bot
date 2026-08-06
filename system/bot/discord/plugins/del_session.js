const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "del_session",
  description: "Delete Gemini conversation history",
  async execute(interaction) {
    const gemini = global.scraper.gemini;
    if (gemini) gemini.clearSession(interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor("#ED4245")
      .setDescription("Session deleted. Conversation history cleared.")
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: 64 });
  }
};
