function splitMessage(text, maxLength) {
  if (text.length <= maxLength) return [ text ];
  const parts = [];
  while (text.length > 0) {
    parts.push(text.slice(0, maxLength));
    text = text.slice(maxLength);
  }
  return parts;
}

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "lyrics" ],
  category: "tools",
  description: "Get lyrics for a song (Genius / LRCLIB)",
  options: [ {
    name: "query",
    type: 3,
    description: "Song title and artist",
    required: true
  } ],
  run: async ctx => {
    const interaction = ctx.interaction;
    const {EmbedBuilder: EmbedBuilder} = interaction.client;
    try {
      await interaction.deferReply();
    } catch (e) {
      return;
    }
    const query = interaction.options.getString("query");
    try {
      const lyricsScraper = global.scraper?.lyrics;
      if (!lyricsScraper) throw new Error("Lyrics module not available.");
      const result = await lyricsScraper.getLyrics(query);
      if (!result || !result.lyrics) {
        return interaction.editReply({
          embeds: [ (new EmbedBuilder).setColor("#ED4245").setDescription(`No lyrics found for **${query}**.`) ]
        });
      }
      const chunks = splitMessage(result.lyrics, 4e3);
      const firstEmbed = (new EmbedBuilder).setColor("#4285F4").setTitle(result.title).setFooter({
        text: `Lyrics by ${result.source}`
      }).setTimestamp();
      if (result.thumbnail) firstEmbed.setThumbnail(result.thumbnail);
      if (result.url) firstEmbed.setURL(result.url);
      firstEmbed.setDescription(chunks[0]);
      await interaction.editReply({
        embeds: [ firstEmbed ]
      });
      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp({
          embeds: [ (new EmbedBuilder).setColor("#4285F4").setDescription(chunks[i]) ]
        });
      }
    } catch (e) {
      console.error("[Lyrics Discord]", e.message);
      await interaction.editReply({
        embeds: [ (new EmbedBuilder).setColor("#ED4245").setDescription("Could not fetch lyrics. Please try again.") ]
      });
    }
  }
});