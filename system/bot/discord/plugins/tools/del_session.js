


const { define } = require("../../../plugin");

module.exports = define({
  name: ["del_session"],
  category: "tools",
  description: "Delete Gemini conversation history",
  run: async (ctx) => {
    const interaction = ctx.interaction;

    const { EmbedBuilder } = interaction.client;
    const gemini = global.scraper.gemini;
    if (gemini) gemini.clearSession(interaction.user.id);

    const embed = new EmbedBuilder()
      .setColor("#ED4245")
      .setDescription("Session deleted. Conversation history cleared.")
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: 64 });
  
  },
});
