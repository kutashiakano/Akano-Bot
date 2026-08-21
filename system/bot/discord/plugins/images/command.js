

const { applyEffect, dcImgBuf } = require("./process");

function mkImgCmd(config) {
  const options = [
    {
      name: "image",
      type: 11,
      description: "Image to process (attach)",
      required: false,
    },
    {
      name: "url",
      type: 3,
      description: "Direct image URL",
      required: false,
    },
    ...(config.options || []),
  ];

  return {
    name: config.name,
    description: config.description,
    options,
    async execute(interaction) {
    const { EmbedBuilder, AttachmentBuilder } = interaction.client;
      try {
        await interaction.deferReply();
      } catch (e) {
        return;
      }
      try {
        const buf = await dcImgBuf(interaction);
        const opts = {};
        for (const opt of config.options || []) {
          const val = interaction.options.get(opt.name)?.value;
          if (val !== undefined && val !== null) opts[opt.name] = val;
        }
        const out = await applyEffect(buf, config.effect, opts);
        const attachment = new AttachmentBuilder(out).setName(`${config.name}.png`);
        await interaction.editReply({ files: [attachment] });
      } catch (e) {
        console.error(`[${config.name}]`, e.message);
        await interaction.editReply({
          embeds: [new EmbedBuilder().setColor("#ED4245").setDescription(`🚩 Error: ${e.message}`)],
        });
      }
    },
  };
}

module.exports = { mkImgCmd };
