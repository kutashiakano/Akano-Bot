const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "gemini",
  description: "Chat with Gemini AI (conversation memory)",
  options: [
    {
      name: "prompt",
      type: 3,
      description: "Your question or message to Gemini",
      required: true
    }
  ],
  async execute(interaction) {
    try { await interaction.deferReply(); } catch (e) { return; }

    const prompt = interaction.options.getString("prompt");
    const userId = interaction.user.id;

    try {
      const gemini = global.scraper.gemini;
      if (!gemini) throw new Error("Gemini module not available.");

      let fullResponse = "";

      await gemini.chat(prompt, userId, (chunk) => {
        fullResponse += chunk;
      });

      if (!fullResponse) throw new Error("Empty response from Gemini.");

      const chunks = splitMessage(fullResponse, 4000);

      const firstEmbed = new EmbedBuilder()
        .setColor("#4285F4")
        .setAuthor({ name: "Gemini AI", iconURL: "https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg" })
        .setDescription(chunks[0])
        .setFooter({ text: `Requested by ${interaction.user.username}` })
        .setTimestamp();

      await interaction.editReply({ embeds: [firstEmbed] });

      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp({
          embeds: [
            new EmbedBuilder()
              .setColor("#4285F4")
              .setDescription(chunks[i])
          ]
        });
      }
    } catch (e) {
      console.error("[Gemini Discord]", e.message);
      if (e.message && e.message.includes("Header overflow")) {
        const gemini = global.scraper.gemini;
        if (gemini) gemini.clearSession(userId);
      }
      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor("#ED4245")
            .setDescription("Gemini is currently unavailable. Please try again later.")
        ]
      });
    }
  }
};

function splitMessage(text, maxLength) {
  if (text.length <= maxLength) return [text];
  const parts = [];
  while (text.length > 0) {
    parts.push(text.slice(0, maxLength));
    text = text.slice(maxLength);
  }
  return parts;
}
