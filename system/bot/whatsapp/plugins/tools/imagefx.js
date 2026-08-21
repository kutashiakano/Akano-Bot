const { downloadStatus } = require("../../lib/utils");
const { applyEffect } = require("../../../discord/plugins/images/process");

const FX_ALIASES = {
  invert: { command: "invert", effect: "invert" },
  invertimage: { command: "invert", effect: "invert" },
  grayscale: { command: "grayscale", effect: "grayscale" },
  grey: { command: "grayscale", effect: "grayscale" },
  sepia: { command: "sepia", effect: "sepia" },
  blur: { command: "blur", effect: "blur", amount: true },
  pixelate: { command: "pixelate", effect: "pixelate", amount: true },
  pixel: { command: "pixelate", effect: "pixelate", amount: true },
  flip: { command: "flip", effect: "flip" },
  rotate: { command: "rotate", effect: "rotate", amount: true },
  contrast: { command: "contrast", effect: "contrast", amount: true },
  meme: { command: "meme", effect: "meme", text: true },
};

async function imgBuf(sock, m, text) {
  const urlMatch = String(text || "").match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    const { fImgBuf } = require("../../../discord/plugins/images/process");
    return fImgBuf(urlMatch[0].replace(/[.,!?;:]+$/, ""));
  }
  const quoted = m.quoted || m;
  if (quoted?.message?.imageMessage) {
    return Buffer.from(await sock.downloadMediaMessage(quoted));
  }
  if (quoted?.message?.videoMessage) {
    throw new Error("Reply to an image, not a video");
  }
  throw new Error("Reply to an image or provide an image URL");
}

const __orig = {
  reg: true,
  help: ["invert", "grayscale", "sepia", "blur", "pixelate", "flip", "rotate", "contrast", "meme"],
  command: [
    "invert",
    "grayscale",
    "sepia",
    "blur",
    "pixelate",
    "flip",
    "rotate",
    "contrast",
    "meme",
  ],
  tags: ["tools"],
  run: async (m, { sock, text, command }) => {
    const fx = FX_ALIASES[command];
    if (!fx) throw new Error("Unknown image command");

    const status = await downloadStatus(m, sock);
    try {
      await status.processing();
      const buf = await imgBuf(sock, m, text);

      const options = {};
      if (fx.amount) {
        const num = parseInt(
          String(text || "")
            .trim()
            .split(/\s+/)[0],
          10,
        );
        if (!isNaN(num)) options.amount = num;
      }
      if (fx.text) {
        const pipeIndex = String(text || "").indexOf("|");
        if (pipeIndex > -1) {
          options.top = String(text).slice(0, pipeIndex).trim();
          options.bottom = String(text)
            .slice(pipeIndex + 1)
            .trim();
        } else {
          options.bottom = String(text || "").trim();
        }
      }

      const out = await applyEffect(buf, fx.effect, options);
      await sock.sendMessage(
        m.chat,
        { image: out, caption: `*${fx.command}* successful` },
        { quoted: m },
      );
      await status.success();
    } catch (e) {
      await status.failed(e);
    }
  },
  example:
    "%cmd (reply to image)\n%cmd <image-url>\n%cmd blur 10\n%cmd meme when you fix the bot|but it still skips",
}
const { define } = require("../../../plugin");

module.exports = define({
  name: [
    "invert",
    "grayscale",
    "sepia",
    "blur",
    "pixelate",
    "flip",
    "rotate",
    "contrast",
    "meme",
  ],
  category: (["tools"])[0] || "tools",
  help: (["invert", "grayscale", "sepia", "blur", "pixelate", "flip", "rotate", "contrast", "meme"])[0] || "",
  reg: true,
  example: "%cmd (reply to image)\n%cmd <image-url>\n%cmd blur 10\n%cmd meme when you fix the bot|but it still skips",
  run: async function (c) { return __orig.run.call(__orig, c.m, c.props); },
});
