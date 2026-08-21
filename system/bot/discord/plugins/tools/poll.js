
const { define } = require("../../../plugin");

module.exports = define({
  name: ["poll"],
  category: "tools",
  description: "Create a native Discord poll",
  options: [
    {
      name: "question",
      type: 3,
      description: "Poll question",
      required: true,
    },
    {
      name: "option1",
      type: 3,
      description: "Option 1",
      required: true,
    },
    {
      name: "option2",
      type: 3,
      description: "Option 2",
      required: true,
    },
    {
      name: "option3",
      type: 3,
      description: "Option 3 (optional)",
      required: false,
    },
    {
      name: "option4",
      type: 3,
      description: "Option 4 (optional)",
      required: false,
    },
    {
      name: "duration",
      type: 4,
      description: "Poll duration in hours (default: 1, min 1, max 168)",
      required: false,
      min_value: 1,
      max_value: 168,
    },
    {
      name: "multiselect",
      type: 5,
      description: "Allow multiple answers (default: false)",
      required: false,
    },
  ],
  run: async (ctx) => {
    const interaction = ctx.interaction;

    try {
      const question = (interaction.options.getString("question") || "").trim();
      const options = [
        interaction.options.getString("option1"),
        interaction.options.getString("option2"),
        interaction.options.getString("option3"),
        interaction.options.getString("option4"),
      ]
        .filter(Boolean)
        .map((t) => t.trim())
        .filter(Boolean);

      if (question.length > 300) {
        return interaction.reply({
          content: "Question is too long (max 300 characters).",
          flags: 64,
        });
      }
      if (options.length > 10) {
        return interaction.reply({ content: "Maximum 10 options.", flags: 64 });
      }

      const hours = Math.min(168, Math.max(1, interaction.options.getInteger("duration") || 1));
      const allowMultiselect = interaction.options.getBoolean("multiselect") || false;

      await interaction.reply({
        poll: {
          question: { text: question },
          answers: options.map((t) => ({ text: t.slice(0, 55) })),
          duration: hours,
          allowMultiselect,
        },
      });
    } catch (e) {
      global.logError("discord.poll", e);
      try {
        await interaction.reply({
          content: "Sorry, an error occurred while creating the poll. Please try again later!",
          flags: 64,
        });
      } catch (err) {}
    }
  
  },
});
