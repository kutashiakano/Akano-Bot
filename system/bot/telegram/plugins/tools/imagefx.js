const {applyEffect: applyEffect, fImgBuf: fImgBuf} = require("../../../discord/plugins/images/process");
const fs = require("fs");

const FX = {
  invert: {
    effect: "invert",
    label: "Invert"
  },
  grayscale: {
    effect: "grayscale",
    label: "Grayscale"
  },
  sepia: {
    effect: "sepia",
    label: "Sepia"
  },
  blur: {
    effect: "blur",
    label: "Blur",
    amount: true
  },
  pixelate: {
    effect: "pixelate",
    label: "Pixelate",
    amount: true
  },
  flip: {
    effect: "flip",
    label: "Flip"
  },
  rotate: {
    effect: "rotate",
    label: "Rotate",
    amount: true
  },
  contrast: {
    effect: "contrast",
    label: "Contrast",
    amount: true
  },
  meme: {
    effect: "meme",
    label: "Meme",
    text: true
  }
};

async function downloadTelegramBuffer(ctx, fileId) {
  if (!fileId) throw new Error("file_id missing");
  let file = null;
  try {
    file = await ctx.api.getFile(fileId);
  } catch (e) {
    throw e;
  }
  if (!file) throw new Error("Failed to get file info");
  if (typeof file.download === "function") {
    const tmpPath = await file.download();
    const buf = await fs.promises.readFile(tmpPath);
    try {
      await fs.promises.unlink(tmpPath).catch(() => {});
    } catch {}
    return buf;
  }
  if (typeof file.getUrl === "function") {
    const url = file.getUrl();
    return fImgBuf(url);
  }
  if (file.file_path) {
    const token = ctx.api && ctx.api.token || global.telegramBot && global.telegramBot.tokenOverride || global.settings && global.settings.telegram && global.settings.telegram.token || "";
    if (token) {
      const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      return fImgBuf(url);
    }
  }
  throw new Error("Cannot download Telegram file (hydrateFiles not configured)");
}

async function imgBuf(ctx, text) {
  const urlMatch = String(text || "").match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    return fImgBuf(urlMatch[0].replace(/[.,!?;:]+$/, ""));
  }
  const msg = ctx.message || ctx.msg;
  const replyMsg = msg?.reply_to_message || ctx.msg?.reply_to_message;
  const photo = (replyMsg?.photo && replyMsg.photo.length ? replyMsg.photo : null) || (msg?.photo && msg.photo.length ? msg.photo : null) || (ctx.msg?.photo && ctx.msg.photo.length ? ctx.msg.photo : null);
  if (photo && photo.length) {
    const largest = photo[photo.length - 1];
    return downloadTelegramBuffer(ctx, largest.file_id);
  }
  const doc = msg?.document || replyMsg?.document || ctx.msg?.document;
  if (doc && doc.file_id) {
    const mime = doc.mime_type || "";
    if (mime.startsWith("image/") || !mime || /\.(jpe?g|png|gif|webp|bmp)$/i.test(doc.file_name || "")) {
      return downloadTelegramBuffer(ctx, doc.file_id);
    }
  }
  throw new Error(global.settings.message.imageNeed);
}

const {define: define} = require("../../../plugin");

module.exports = define({
  name: Object.keys(FX),
  category: "tools",
  help: "Apply image effects",
  run: async ctx => {
    const args = ctx.text || "";
    const cmd = ctx.message?.text?.split(" ")[0].replace("/", "").toLowerCase();
    const fx = FX[cmd];
    if (!fx) return ctx.reply(global.settings.message.unknownImageCommand);
    try {
      await (ctx.replyWithChatAction ? ctx.replyWithChatAction("upload_photo") : ctx.api?.sendChatAction(ctx.chat?.id, "upload_photo")).catch(() => {});
      const buf = await imgBuf(ctx, args);
      const options = {};
      if (fx.amount) {
        const num = parseInt(String(args || "").trim().split(/\s+/)[0], 10);
        if (!isNaN(num)) options.amount = num;
      }
      if (fx.text) {
        const pipeIndex = String(args || "").indexOf("|");
        if (pipeIndex > -1) {
          options.top = String(args).slice(0, pipeIndex).trim();
          options.bottom = String(args).slice(pipeIndex + 1).trim();
        } else {
          options.bottom = String(args || "").trim();
        }
      }
      let out = await applyEffect(buf, fx.effect, options);
      const TG_LIMIT = 9 * 1024 * 1024;
      if (out.length > TG_LIMIT) {
        try {
          const {Jimp: Jimp} = require("jimp");
          let img = await Jimp.read(out);
          if (img.width > 2e3 || img.height > 2e3) {
            const r = Math.min(2e3 / img.width, 2e3 / img.height);
            img = img.resize({
              w: Math.round(img.width * r),
              h: Math.round(img.height * r)
            });
          }
          img.quality(82);
          out = await img.getBuffer("image/jpeg");
          if (out.length > TG_LIMIT) {
            img.quality(65);
            out = await img.getBuffer("image/jpeg");
          }
        } catch {}
      }
      try {
        await ctx.replyWithPhoto({
          source: out
        }, {
          caption: `*${fx.label}*`,
          parse_mode: "Markdown"
        });
      } catch (sendErr) {
        const msg = String(sendErr.message || sendErr);
        if (msg.includes("413") || msg.includes("too large") || msg.includes("Request Entity Too Large")) {
          try {
            const {Jimp: Jimp} = require("jimp");
            let img = await Jimp.read(out);
            const r = Math.min(1280 / img.width, 1280 / img.height, 1);
            if (r < 1) img = img.resize({
              w: Math.round(img.width * r),
              h: Math.round(img.height * r)
            });
            img.quality(70);
            const small = await img.getBuffer("image/jpeg");
            await ctx.replyWithPhoto({
              source: small
            }, {
              caption: `*${fx.label}* (compressed)`,
              parse_mode: "Markdown"
            });
            return;
          } catch {}
          try {
            await ctx.replyWithDocument({
              source: out
            }, {
              caption: `*${fx.label}*`,
              parse_mode: "Markdown"
            });
            return;
          } catch {}
        }
        throw sendErr;
      }
    } catch (e) {
      const emsg = e.message || String(e);
      console.error("[ImageFX TG]", emsg);
      if (emsg.includes("413") || emsg.includes("too large")) {
        await ctx.reply(global.settings.message.imageTooLarge);
      } else {
        await ctx.reply(global.settings.message.downloaderError.replace("{error}", emsg));
      }
    }
  }
});