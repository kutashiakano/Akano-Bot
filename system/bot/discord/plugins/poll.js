const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType
} = require("discord.js");

module.exports = {
  name: "poll",
  description: "Create a poll with vote buttons",
  options: [
    {
      name: "question",
      type: 3,
      description: "Poll question",
      required: true
    },
    {
      name: "option1",
      type: 3,
      description: "Option 1",
      required: true
    },
    {
      name: "option2",
      type: 3,
      description: "Option 2",
      required: true
    },
    {
      name: "option3",
      type: 3,
      description: "Option 3 (optional)",
      required: false
    },
    {
      name: "option4",
      type: 3,
      description: "Option 4 (optional)",
      required: false
    },
    {
      name: "duration",
      type: 4,
      description: "Poll duration in minutes (default: 60)",
      required: false,
      min_value: 1,
      max_value: 1440
    }
  ],
  async execute(interaction) {
    try { await interaction.deferReply(); } catch (e) { return; }

    const question = interaction.options.getString("question");
    const options = [
      interaction.options.getString("option1"),
      interaction.options.getString("option2"),
      interaction.options.getString("option3"),
      interaction.options.getString("option4")
    ].filter(Boolean);

    const duration = (interaction.options.getInteger("duration") || 60) * 60 * 1000;
    const endTime = Math.floor((Date.now() + duration) / 1000);

    const votes = new Map();
    const voters = new Map();
    options.forEach((_, i) => votes.set(i, 0));

    const emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];

    function buildEmbed(ended = false) {
      const totalVotes = [...votes.values()].reduce((a, b) => a + b, 0);
      const description = options.map((opt, i) => {
        const count = votes.get(i) || 0;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
        return `${emojis[i]} **${opt}**\n${bar} \`${count} vote (${pct}%)\``;
      }).join("\n\n");

      return new EmbedBuilder()
        .setColor(ended ? "#57F287" : "#5865F2")
        .setTitle(ended ? "Poll Ended" : "Active Poll")
        .setDescription(`**${question}**\n\n${description}`)
        .addFields(
          { name: "Total Votes", value: `\`${totalVotes}\``, inline: true },
          { name: ended ? "Ended" : "Ends", value: `<t:${endTime}:R>`, inline: true }
        )
        .setFooter({ text: `Created by ${interaction.user.username}` })
        .setTimestamp();
    }

    function buildRow(disabled = false) {
      const row = new ActionRowBuilder();
      options.forEach((opt, i) => {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`poll_vote_${i}`)
            .setLabel(opt.length > 20 ? opt.slice(0, 20) + "..." : opt)
            .setEmoji(emojis[i])
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabled)
        );
      });
      return row;
    }

    const message = await interaction.editReply({
      embeds: [buildEmbed()],
      components: [buildRow()]
    });

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: duration
    });

    collector.on("collect", async (btn) => {
      const optIndex = parseInt(btn.customId.split("_")[2]);
      const prevVote = voters.get(btn.user.id);

      if (prevVote === optIndex) {
        await btn.reply({ content: "You already voted for this option.", flags: 64 });
        return;
      }

      if (prevVote !== undefined) {
        votes.set(prevVote, (votes.get(prevVote) || 0) - 1);
      }

      votes.set(optIndex, (votes.get(optIndex) || 0) + 1);
      voters.set(btn.user.id, optIndex);

      await btn.update({ embeds: [buildEmbed()], components: [buildRow()] });
    });

    collector.on("end", async () => {
      try {
        await message.edit({ embeds: [buildEmbed(true)], components: [buildRow(true)] });
      } catch (e) {}
    });
  }
};
