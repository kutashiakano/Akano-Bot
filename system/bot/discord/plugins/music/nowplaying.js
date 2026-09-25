import sdkFacade from "../../../sdk/index.js";
import { card, discord as dcSdk } from "@kutashiakanocanzy/sdk";
import { formatDuration, bar } from "./utils.js";

const { define } = sdkFacade;

export default define({
  name: [ "np" ],
  category: "music",
  help: "Show info about the currently playing song",
  options: [],
  run: async ctx => {
    const interaction = ctx.interaction;
    try {
      await dcSdk.thinking(interaction);
    } catch (e) {
      return;
    }
    const playCmd = global.discordCommands["p"];
    const queues = playCmd?.getQueues?.();
    const queue = queues?.get(interaction.guildId);
    if (!queue || !queue.currentSong) {
      return dcSdk.editReply(interaction, {
        embeds: [ card().setColor("#ED4245").setDescription("No music is currently playing.") ]
      });
    }
    const song = queue.currentSong;
    const resource = queue.currentResource;
    const elapsed = resource ? Math.floor(resource.playbackDuration / 1e3) : 0;
    const total = song.duration || 0;
    const progress = bar(elapsed, total);
    const embed = card().setColor("#5865F2").setTitle("Now Playing").setDescription(`[${song.title}](${song.url})`).setThumbnail(song.thumbnail || null).addFields({
      name: "Progress",
      value: `\`${formatDuration(elapsed)}\` ${progress} \`${formatDuration(total)}\``,
      inline: false
    }, {
      name: "Artist",
      value: song.uploader,
      inline: true
    }, {
      name: "Requester",
      value: song.requester,
      inline: true
    }, {
      name: "Status",
      value: queue.paused ? "**Paused**" : "**Playing**",
      inline: true
    });
    await dcSdk.editReply(interaction, {
      embeds: [ embed ]
    });
  }
});
