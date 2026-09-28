import { card } from "@kutashiakanocanzy/sdk";
import { mkImgCmd } from "./command.js";

import { defineBot as define } from "@kutashiakanocanzy/sdk";

const EFFECTS = {
  blur: {
    description: "Blur an image",
    options: [{ name: "amount", type: 4, description: "Blur intensity (1-50, default 3)", required: false }]
  },
  contrast: {
    description: "Adjust image contrast",
    options: [{ name: "amount", type: 3, description: "Contrast -100 to 100 (default 50)", required: false }]
  },
  flip: {
    description: "Flip an image horizontally",
    options: []
  },
  grayscale: {
    description: "Convert an image to black and white",
    options: []
  },
  invert: {
    description: "Invert the colors of an image",
    options: []
  },
  meme: {
    description: "Add top/bottom captions to an image (meme style)",
    options: [
      { name: "top", type: 3, description: "Top caption text", required: false },
      { name: "bottom", type: 3, description: "Bottom caption text", required: false }
    ]
  },
  pixelate: {
    description: "Pixelate an image",
    options: [{ name: "amount", type: 4, description: "Pixel block size (1-50, default 8)", required: false }]
  },
  rotate: {
    description: "Rotate an image by degrees",
    options: [{ name: "amount", type: 3, description: "Rotation degrees (default 90)", required: false }]
  },
  sepia: {
    description: "Apply a sepia tone filter",
    options: []
  }
};

const runners = {};
for (const [effect, cfg] of Object.entries(EFFECTS)) {
  runners[effect] = mkImgCmd({ name: effect, description: cfg.description, options: cfg.options, effect: effect });
}

const amountOpt = { name: "amount", type: 3, description: "Effect amount (blur 1-50, pixel 1-50, rotate degrees, contrast -100..100)", required: false };

export default define({
  name: [ "image" ],
  category: "images",
  help: "Apply an effect to an image (blur, meme, rotate, ...)",
  options: [
    { name: "effect", type: 3, description: "Effect to apply", required: true, choices: Object.keys(EFFECTS).map(k => ({ name: k, value: k })) },
    { name: "image", type: 11, description: "Image to process (attach)", required: false },
    { name: "url", type: 3, description: "Direct image URL", required: false },
    amountOpt,
    { name: "top", type: 3, description: "Top caption text (meme)", required: false },
    { name: "bottom", type: 3, description: "Bottom caption text (meme)", required: false }
  ],
  run: async ctx => {
    const interaction = ctx.interaction;
    const effect = String(interaction.options.getString("effect") || "").toLowerCase();
    const base = runners[effect];
    if (!base) {
      return interaction.reply({ content: "Unknown effect. Pick one: " + Object.keys(EFFECTS).join(", "), flags: 64 }).catch(() => {});
    }
    return base.execute(interaction);
  }
});
