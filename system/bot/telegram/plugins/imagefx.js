const { applyEffect, fImgBuf } = require("../../discord/plugins/images/process");

const FX = {
  invert: { effect: "invert", label: "Invert" },
  grayscale: { effect: "grayscale", label: "Grayscale" },
  sepia: { effect: "sepia", label: "Sepia" },
  blur: { effect: "blur", label: "Blur", amount: true },
  pixelate: { effect: "pixelate", label: "Pixelate", amount: true },
  flip: { effect: "flip", label: "Flip" },
  rotate: { effect: "rotate", label: "Rotate", amount: true },
  contrast: { effect: "contrast", label: "Contrast", amount: true },
  meme: { effect: "meme", label: "Meme", text: true },
};

async function imgBuf(ctx, text) {
  const urlMatch = String(text || "").match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    return fImgBuf(urlMatch[0].replace(/[.,!?;:]+$/, ""));
  }
  const photo = ctx.message?.reply_to_message?.photo || ctx.message?.photo;
  if (photo && photo.length) {
    const largest = photo[photo.length - 1];
    const link = await ctx.telegram.getFileLink(largest.file_id);
    return fImgBuf(link.href);
  }
  if (ctx.message?.document) {
    const link = await ctx.telegram.getFileLink(ctx.message.document.file_id);
    return fImgBuf(link.href);
  }
  throw new Error("Send/forward an image or provide an image URL");
}


const { define } = require("../../plugin");

module.exports = define({
  name: [Object.keys(FX)],
  category: "tools",
  help: "Image effects: invert, grayscale, sepia, blur, pixelate, flip, rotate, contrast, meme",

  run: async (ctx) => {

    const cmd = ctx.message?.text?.split(" ")[0].replace("/", "").toLowerCase();
    const fx = FX[cmd];
    if (!fx) return ctx.reply("Unknown image command.");

    try {
      await ctx.chatAct("upload_photo").catch(() => {});
      const buf = await imgBuf(ctx, args);

      const options = {};
      if (fx.amount) {
        const num = parseInt(
          String(args || "")
            .trim()
            .split(/\s+/)[0],
          10,
        );
        if (!isNaN(num)) options.amount = num;
      }
      if (fx.text) {
        const pipeIndex = String(args || "").indexOf("|");
        if (pipeIndex > -1) {
          options.top = String(args).slice(0, pipeIndex).trim();
          options.bottom = String(args)
            .slice(pipeIndex + 1)
            .trim();
        } else {
          options.bottom = String(args || "").trim();
        }
      }

      const out = await applyEffect(buf, fx.effect, options);
      await ctx.replyWithPhoto({ source: out }, { caption: `*${fx.label}*` });
    } catch (e) {
      console.error("[ImageFX TG]", e.message);
      await ctx.reply(`Error: ${e.message}`);
    }
  
  },
});
