const {formatDuration: formatDuration} = require("./utils");
const {queues: queues, mkQueue: mkQueue, playNext: playNext} = require("./engine");

const searchResults = new Map;

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "search" ],
  category: "music",
  help: "Search for music on YouTube and pick a result to play",
  options: [ {
    name: "query",
    type: 3,
    description: "Song title or search query",
    required: true
  } ],
  run: async ctx => {
    const interaction = ctx.interaction;
    try {
      await interaction.deferReply();
    } catch (e) {
      return;
    }
    const guild = interaction.guild;
    let member = interaction.member;
    let channel = member?.voice?.channel;
    if (!channel) {
      try {
        member = await guild.members.fetch(interaction.user.id);
        channel = member?.voice?.channel;
      } catch (err) {}
    }
    if (!channel) {
      return interaction.editReply({
        embeds: [ (new interaction.client.ebuilder).setColor("#ED4245").setDescription("You must be in a voice channel to use this command.") ]
      });
    }
    const query = interaction.options.getString("query");
    const userId = interaction.user.id;
    try {
      const downloader = global.scraper?.ytdpl;
      if (!downloader) throw new Error("Downloader not available.");
      let results;
      if (typeof downloader.search === "function") {
        results = await downloader.search(query, {
          limit: 9
        });
      } else {
        results = await downloader.getMetadata("ytsearch9:" + query);
      }
      if (!results || !Array.isArray(results) || results.length === 0) {
        throw new Error("No results found.");
      }
      const tracks = results.slice(0, 9);
      await Promise.all(tracks.map(async track => {
        if (!track.duration && track.url) {
          try {
            const meta = await downloader.getMetadata(track.url);
            const info = Array.isArray(meta) ? meta[0] : meta;
            if (info && info.duration) track.duration = info.duration;
          } catch {}
        }
      }));
      if (searchResults.has(userId)) {
        const prev = searchResults.get(userId);
        if (prev.timeout) clearTimeout(prev.timeout);
      }
      const timeout = setTimeout(() => searchResults.delete(userId), 5 * 60 * 1e3);
      searchResults.set(userId, {
        results: tracks,
        timeout: timeout
      });
      const description = tracks.map((track, i) => `\`${i + 1}.\` **${track.title || "Unknown"}** — ${track.uploader || track.channel || "Unknown"} \`${formatDuration(track.duration)}\``).join("\n");
      const embed = (new interaction.client.ebuilder).setColor("#5865F2").setTitle("Search Results").setDescription(`**Query:** ${query}\n\n${description}`).setFooter({
        text: "Select a track to play • Expires in 5 minutes"
      });
      const row1 = new interaction.client.abuilder;
      for (let i = 0; i < Math.min(4, tracks.length); i++) {
        row1.addComponents((new interaction.client.bbuilder).setCustomId(`search_select_${i}`).setLabel(`${i + 1}`).setStyle(interaction.client.ButtonStyle.Primary));
      }
      row1.addComponents((new interaction.client.bbuilder).setCustomId("search_cancel").setLabel("Cancel").setStyle(interaction.client.ButtonStyle.Danger));
      const row2 = new interaction.client.abuilder;
      for (let i = 4; i < Math.min(9, tracks.length); i++) {
        row2.addComponents((new interaction.client.bbuilder).setCustomId(`search_select_${i}`).setLabel(`${i + 1}`).setStyle(interaction.client.ButtonStyle.Primary));
      }
      const components = tracks.length > 4 ? [ row1, row2 ] : [ row1 ];
      const reply = await interaction.editReply({
        embeds: [ embed ],
        components: components
      });
      const collector = reply.createMessageComponentCollector({
        component: c => c.isButton(),
        time: 5 * 60 * 1e3,
        max: 1
      });
      collector.on("collect", async btn => {
        if (btn.user.id !== userId) {
          await btn.reply({
            content: "This isn't your search.",
            flags: 64
          }).catch(() => {});
          return;
        }
        if (btn.customId === "search_cancel") {
          const data = searchResults.get(userId);
          if (data && data.timeout) clearTimeout(data.timeout);
          searchResults.delete(userId);
          await btn.update({
            embeds: [ (new interaction.client.ebuilder).setColor("#ED4245").setDescription("Search cancelled.") ],
            components: []
          });
          return;
        }
        await btn.deferUpdate().catch(() => {});
        const index = parseInt(btn.customId.replace("search_select_", ""));
        const data = searchResults.get(userId);
        if (!data || !data.results[index]) {
          await btn.followUp({
            content: "Invalid selection.",
            flags: 64
          }).catch(() => {});
          return;
        }
        const track = data.results[index];
        if (data.timeout) clearTimeout(data.timeout);
        searchResults.delete(userId);
        let member = btn.member;
        let channel = member?.voice?.channel;
        if (!channel) {
          try {
            member = await btn.guild.members.fetch(userId);
            channel = member?.voice?.channel;
          } catch (err) {}
        }
        if (!channel) {
          await btn.followUp({
            embeds: [ (new interaction.client.ebuilder).setColor("#ED4245").setDescription("You must be in a voice channel.") ],
            flags: 64
          }).catch(() => {});
          return;
        }
        try {
          const song = {
            title: track.title || "Unknown",
            url: track.webpage_url || track.url || track.original_url,
            thumbnail: track.thumbnail || "",
            duration: track.duration || 0,
            uploader: track.uploader || track.channel || "Unknown",
            requester: `<@${userId}>`,
            requesterId: userId,
            source: "YouTube"
          };
          const guildId = btn.guildId;
          const queue = await mkQueue(guildId, channel, btn.channel);
          const isFirst = queue.songs.length === 0 && !queue.currentSong;
          queue.songs.push(song);
          if (!isFirst) {
            const position = queue.songs.length;
            await btn.followUp({
              embeds: [ (new interaction.client.ebuilder).setColor("#5865F2").setTitle("Added to Queue").setDescription(`[${song.title}](${song.url})`).setThumbnail(song.thumbnail || null).addFields({
                name: "Duration",
                value: `\`[${formatDuration(song.duration)}]\``,
                inline: true
              }, {
                name: "Source",
                value: `\`${song.source}\``,
                inline: true
              }, {
                name: "Position",
                value: `\`#${position}\``,
                inline: true
              }) ],
              flags: 64
            }).catch(() => {});
            return;
          }
          await btn.followUp({
            embeds: [ (new interaction.client.ebuilder).setColor("#57F287").setDescription(`🕒 Loading: **${song.title}**...`) ],
            flags: 64
          }).catch(() => {});
          await playNext(guildId);
        } catch (error) {
          global.logError("dc.music.search.play", error);
          await btn.followUp({
            embeds: [ (new interaction.client.ebuilder).setColor("#ED4245").setDescription(`Error: ${error.message}`) ],
            flags: 64
          }).catch(() => {});
        }
      });
      collector.on("end", collected => {
        const data = searchResults.get(userId);
        if (data && data.timeout) clearTimeout(data.timeout);
        searchResults.delete(userId);
        if (collected.size === 0) {
          interaction.editReply({
            embeds: [ (new interaction.client.ebuilder).setColor("#ED4245").setDescription("Search timed out.") ],
            components: []
          }).catch(() => {});
        } else {
          interaction.editReply({
            components: []
          }).catch(() => {});
        }
      });
    } catch (error) {
      global.logError("dc.music.search", error);
      try {
        await interaction.editReply({
          embeds: [ (new interaction.client.ebuilder).setColor("#ED4245").setDescription(`Error: ${error.message}`) ]
        });
      } catch (e) {}
    }
  }
});