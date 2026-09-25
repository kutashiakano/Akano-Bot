import sdkFacade from "../../../sdk/index.js";
import { card, discord as dcSdk } from "@kutashiakanocanzy/sdk";

const { define } = sdkFacade;

export default define({
  name: [ "skip" ],
  category: "music",
  description: "Skip the currently playing song",
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
    const skippedTitle = queue.currentSong.title;
    queue.player.stop();
    await dcSdk.editReply(interaction, {
      embeds: [ card().setColor("#FEE75C").setDescription(`Skipped **${skippedTitle}**.`).setFooter({
        text: `Requested by ${interaction.user.username}`
      }) ]
    });
  }
});
