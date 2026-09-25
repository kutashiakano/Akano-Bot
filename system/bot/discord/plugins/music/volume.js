import { card, discord as dcSdk } from "@kutashiakanocanzy/sdk";
import { createVolumeBar } from "./utils.js";
import { svState } from "./state.js";

import { defineBot as define } from "@kutashiakanocanzy/sdk";

export default define({
  name: [ "volume" ],
  category: "music",
  help: "Set music volume (1-100)",
  options: [ {
    name: "level",
    type: 4,
    description: "Volume level (1-100, default 100)",
    required: true,
    min_value: 1,
    max_value: 100
  } ],
  run: async ctx => {
    const interaction = ctx.interaction;
    try {
      await dcSdk.thinking(interaction);
    } catch {
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
    const level = interaction.options.getInteger("level");
    const volumeFloat = Math.min(1, Math.max(0, level / 100));
    queue.volume = volumeFloat;
    if (queue.currentResource?.volume) {
      queue.currentResource.volume.setVolume(volumeFloat);
    }
    svState(interaction.guildId, queue);
    const bar = createVolumeBar(level);
    await dcSdk.editReply(interaction, {
      embeds: [ card().setColor("#57F287").setTitle("Volume Set").setDescription(`${bar} \`${level}%\``) ]
    });
  }
});
