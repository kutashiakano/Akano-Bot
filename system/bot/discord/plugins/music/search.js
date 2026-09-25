import { discord as dcNs } from "@kutashiakanocanzy/sdk";
import { card, button, actionRow, watch, discord as dcSdk } from "@kutashiakanocanzy/sdk";
import { formatDuration } from "./utils.js";
import { queues, mkQueue, playNext } from "./engine.js";

import { defineBot as define } from "@kutashiakanocanzy/sdk";
const { ButtonStyle } = dcNs.engine();

const searchResults = new Map;

export default define({
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
      await dcSdk.thinking(interaction);
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
      return dcSdk.editReply(interaction, {
        embeds: [ card().setColor("#ED4245").setDescription("You must be in a voice channel to use this command.") ]
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
      const embed = card().setColor("#5865F2").setTitle("Search Results").setDescription(`**Query:** ${query}\n\n${description}`).setFooter({
        text: "Select a track to play • Expires in 5 minutes"
      });
      const btns1 = [];
      for (let i = 0; i < Math.min(4, tracks.length); i++) {
        btns1.push(button(`search_select_${i}`, `${i + 1}`, ButtonStyle.Primary));
      }
      btns1.push(button("search_cancel", "Cancel", ButtonStyle.Danger));
      const row1 = actionRow(btns1);
      const components = [ row1 ];
      if (tracks.length > 4) {
        const btns2 = [];
        for (let i = 4; i < Math.min(9, tracks.length); i++) {
          btns2.push(button(`search_select_${i}`, `${i + 1}`, ButtonStyle.Primary));
        }
        components.push(actionRow(btns2));
      }
      const reply = await dcSdk.editReply(interaction, {
        embeds: [ embed ],
        components: components
      });
      let picked = false;
      await watch(reply, () => true, 5 * 60 * 1e3, () => {
        const data = searchResults.get(userId);
        if (data && data.timeout) clearTimeout(data.timeout);
        searchResults.delete(userId);
        if (!picked) {
          dcSdk.editReply(interaction, {
            embeds: [ card().setColor("#ED4245").setDescription("Search timed out.") ],
            components: []
          }).catch(() => {});
        } else {
          dcSdk.editReply(interaction, {
            components: []
          }).catch(() => {});
        }
      }, {
        max: 1,
        collect: async btn => {
          if (btn.user.id !== userId) {
            await btn.reply({
              content: "This isn't your search.",
              flags: 64
            }).catch(() => {});
            return;
          }
          if (btn.customId === "search_cancel") {
            picked = true;
            const data = searchResults.get(userId);
            if (data && data.timeout) clearTimeout(data.timeout);
            searchResults.delete(userId);
            await btn.update({
              embeds: [ card().setColor("#ED4245").setDescription("Search cancelled.") ],
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
          picked = true;
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
              embeds: [ card().setColor("#ED4245").setDescription("You must be in a voice channel.") ],
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
                embeds: [ card().setColor("#5865F2").setTitle("Added to Queue").setDescription(`[${song.title}](${song.url})`).setThumbnail(song.thumbnail || null).addFields({
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
              embeds: [ card().setColor("#57F287").setDescription(`🕒 Loading: **${song.title}**...`) ],
              flags: 64
            }).catch(() => {});
            await playNext(guildId);
          } catch (error) {
            global.logError("dc.music.search.play", error);
            await btn.followUp({
              embeds: [ card().setColor("#ED4245").setDescription(`Error: ${error.message}`) ],
              flags: 64
            }).catch(() => {});
          }
        }
      });
    } catch (error) {
      global.logError("dc.music.search", error);
      try {
        await dcSdk.editReply(interaction, {
          embeds: [ card().setColor("#ED4245").setDescription(`Error: ${error.message}`) ]
        });
      } catch (e) {}
    }
  }
});
