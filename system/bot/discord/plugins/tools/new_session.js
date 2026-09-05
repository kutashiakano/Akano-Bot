const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "new_session" ],
  category: "tools",
  description: "Start new Gemini conversation (clear history)",
  run: async ctx => {
    const interaction = ctx.interaction;
    const {EmbedBuilder: EmbedBuilder} = interaction.client;
    const gemini = global.scraper.gemini;
    if (gemini) gemini.clearSession(interaction.user.id);
    const embed = (new EmbedBuilder).setColor("#57F287").setDescription("New session started. Conversation history cleared.").setTimestamp();
    await interaction.reply({
      embeds: [ embed ],
      flags: 64
    });
  }
});