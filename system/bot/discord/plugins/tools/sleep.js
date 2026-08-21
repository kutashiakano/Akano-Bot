const { queues, clearQ } = require("../music/engine.js");

const timers = new Map();


const { define } = require("../../../plugin");

module.exports = define({
  name: ["sleep"],
  category: "tools",
  description: "Stop playback after a set time (minutes)",
  options: [
    {
      name: "minutes",
      type: 4,
      description: "Minutes until playback stops (1-180)",
      required: false,
      min_value: 1,
      max_value: 180,
    },
    {
      name: "off",
      type: 5,
      description: "Cancel the active sleep timer",
      required: false,
    },
  ],
  run: async (ctx) => {
    const interaction = ctx.interaction;

    const gid = interaction.guildId;
    const min = interaction.options.getInteger("minutes");
    const off = interaction.options.getBoolean("off");
    const old = timers.get(gid);

    if (off) {
      if (old) {
        clearTimeout(old);
        timers.delete(gid);
        return interaction.reply({
          content: "Sleep timer cancelled.",
          flags: 64,
        });
      }
      return interaction.reply({
        content: "No active sleep timer in this server.",
        flags: 64,
      });
    }

    if (!min) {
      return interaction.reply({
        content: "Usage: `/sleep <minutes>` or `/sleep off`.",
        flags: 64,
      });
    }

    if (!queues.get(gid)) {
      return interaction.reply({
        content: "Nothing is playing in this server.",
        flags: 64,
      });
    }

    if (old) clearTimeout(old);
    const t = setTimeout(() => {
      timers.delete(gid);
      try {
        clearQ(gid);
      } catch (e) {
        global.logError("dc.sleep", e);
      }
    }, min * 60 * 1000);
    timers.set(gid, t);

    return interaction.reply({
      content: `Sleep timer set - playback stops in ${min} min.`,
      flags: 64,
    });
  
  },
});
