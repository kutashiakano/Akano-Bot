import { discord as dcNs } from "@kutashiakanocanzy/sdk";
import { card } from "@kutashiakanocanzy/sdk";
import { applyEffect, dcImgBuf } from "./process.js";

import { defineBot as define } from "@kutashiakanocanzy/sdk";
const { AttachmentBuilder } = dcNs.engine();

function mkImgCmd(config) {
  const options = [ {
    name: "image",
    type: 11,
    description: "Image to process (attach)",
    required: false
  }, {
    name: "url",
    type: 3,
    description: "Direct image URL",
    required: false
  }, ...config.options || [] ];
  return {
    name: config.name,
    description: config.description,
    options: options,
    async execute(interaction) {
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
        await interaction.editReply({
          files: [ attachment ]
        });
      } catch (e) {
        console.error(`[${config.name}]`, e.message);
        await interaction.editReply({
          embeds: [ card().setColor("#ED4245").setDescription(`🚩 Error: ${e.message}`) ]
        });
      }
    }
  };
}

export {
  mkImgCmd
};
