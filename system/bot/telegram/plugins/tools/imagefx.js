const { applyEffect: applyEffect, fImgBuf: fImgBuf } = require("../../../discord/plugins/images/process");
const fs = require("fs");

const tgsdk = require("../../../sdk/telegram");
const { TG_PHOTO_MAX, TG_UPLOAD_MAX } = require("../../../sdk/core");

function toInputFile(buf, filename) {
  return tgsdk.inputFile(buf, filename || "result.jpg");
}

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

async function normalizeForTelegram(buf) {
  const { Jimp: Jimp } = require("jimp");
  let img = await Jimp.read(buf);
  let { width: w, height: h } = img;
  const ratio = Math.max(w, h) / Math.max(1, Math.min(w, h));
  let maxSide = 2560;
  if (w + h > 10000) maxSide = Math.min(maxSide, 2000);
  if (ratio > 20) {
    if (w > h) w = h * 20; else h = w * 20;
  }
  if (w > maxSide || h > maxSide) {
    const r = Math.min(maxSide / w, maxSide / h);
    img = img.resize({ w: Math.round(w * r), h: Math.round(h * r) });
  }

  let out = await img.getBuffer("image/jpeg", { quality: 85 });
  if (out.length > TG_PHOTO_MAX) {
    out = await img.getBuffer("image/jpeg", { quality: 70 });
  }
  if (out.length > TG_PHOTO_MAX) {
    const rw = img.width, rh = img.height;
    const r = Math.min(1280 / rw, 1280 / rh, 1);
    if (r < 1) img = img.resize({ w: Math.round(rw * r), h: Math.round(rh * r) });
    out = await img.getBuffer("image/jpeg", { quality: 65 });
  }
  return out;
}

const { define: define } = require("../../../sdk");

module.exports = define({
  name: Object.keys(FX),
  category: "tools",
  help: "Apply image effects",
  run: async ctx => {
    const msg = ctx.message || ctx.msg || {};
    const args = ctx.text || msg.caption || "";
    const cmd = (msg.text || msg.caption || "").split(" ")[0].replace("/", "").toLowerCase();
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
      try {
        out = await normalizeForTelegram(out);
      } catch (e) {
        console.error("[ImageFX TG] normalize failed:", e.message);
      }
      console.log(`[ImageFX TG] ${fx.effect}: ${(out.length / 1024 / 1024).toFixed(2)}MB`);
      try {
        await ctx.replyWithPhoto(toInputFile(out, `${fx.effect}.jpg`), {
          caption: `*${fx.label}*`,
          parse_mode: "Markdown"
        });
        return;
      } catch (sendErr) {
        const msg = String(sendErr?.message || sendErr);
        console.error("[ImageFX TG] sendPhoto failed:", msg.slice(0, 200));
        const isTooLarge = /413|too large|Request Entity Too Large|PHOTO_INVALID_DIMENSIONS|wrong file identifier|failed to get HTTP URL content/i.test(msg);
        if (isTooLarge && out.length <= TG_UPLOAD_MAX) {
          try {
            await ctx.replyWithDocument(toInputFile(out, `${fx.effect}.jpg`), {
              caption: `*${fx.label}* (as document — too large for photo)`,
              parse_mode: "Markdown"
            });
            return;
          } catch (e2) {
            console.error("[ImageFX TG] sendDocument failed:", String(e2?.message || e2).slice(0, 200));
          }
        }
        throw sendErr;
      }
    } catch (e) {
      const emsg = e.message || String(e);
      console.error("[ImageFX TG]", emsg);
      if (/413|too large|Request Entity Too Large|PHOTO_INVALID_DIMENSIONS/i.test(emsg)) {
        await ctx.reply(global.settings.message.imageTooLarge);
      } else {
        await ctx.reply(global.settings.message.downloaderError.replace("{error}", emsg));
      }
    }
  }
});
