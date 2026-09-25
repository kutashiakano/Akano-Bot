import { card, chop, discord as dcSdk } from "@kutashiakanocanzy/sdk";

import { defineBot as define } from "@kutashiakanocanzy/sdk";

export default define({
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
    try {
      await dcSdk.thinking(interaction);
    } catch (e) {
      return;
    }
    const query = interaction.options.getString("query");
    try {
      const lyricsScraper = global.scraper?.lyrics;
      if (!lyricsScraper) throw new Error("Lyrics module not available.");
      const result = await lyricsScraper.getLyrics(query);
      if (!result || !result.lyrics) {
        return dcSdk.editReply(interaction, {
          embeds: [ card().setColor("#ED4245").setDescription(`No lyrics found for **${query}**.`) ]
        });
      }
      const chunks = chop(result.lyrics, 4e3);
      const firstEmbed = card().setColor("#4285F4").setTitle(result.title).setFooter({
        text: `Lyrics by ${result.source}`
      }).setTimestamp();
      if (result.thumbnail) firstEmbed.setThumbnail(result.thumbnail);
      if (result.url) firstEmbed.setURL(result.url);
      firstEmbed.setDescription(chunks[0]);
      await dcSdk.editReply(interaction, {
        embeds: [ firstEmbed ]
      });
      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp({
          embeds: [ card().setColor("#4285F4").setDescription(chunks[i]) ]
        });
      }
    } catch (e) {
      console.error("[Lyrics Discord]", e.message);
      await dcSdk.editReply(interaction, {
        embeds: [ card().setColor("#ED4245").setDescription("Could not fetch lyrics. Please try again.") ]
      });
    }
  }
});
