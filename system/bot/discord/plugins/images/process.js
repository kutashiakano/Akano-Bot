const { Jimp, measureText, measureTextHeight } = require("jimp");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");
const { loadBitmapFontData } = require(
  path.join(path.dirname(require.resolve("@jimp/plugin-print")), "load-bitmap-font.js"),
);

const FONT_PATH = path.join(
  path.dirname(require.resolve("@jimp/plugin-print")),
  "../../fonts/open-sans/open-sans-32-white/open-sans-32-white",
);

let fontCache = null;
async function getMemeFont() {
  if (fontCache) return fontCache;
  const fntText = fs.readFileSync(FONT_PATH + ".fnt", "utf8");
  const pngDataUrl =
    "data:image/png;base64," + fs.readFileSync(FONT_PATH + ".png").toString("base64");
  const font = await loadBitmapFontData(Buffer.from(fntText));
  const chars = {};
  for (const c of font.chars || []) chars[String.fromCharCode(c.id)] = c;
  const kernings = {};
  for (const k of font.kernings || []) {
    const first = String.fromCharCode(k.first);
    kernings[first] = kernings[first] || {};
    kernings[first][String.fromCharCode(k.second)] = k.amount;
  }
  font.chars = chars;
  font.kernings = kernings;
  font.pages = await Promise.all((font.pages || []).map(() => Jimp.read(pngDataUrl)));
  fontCache = font;
  return font;
}

async function fImgBuf(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error("Failed to fetch image: HTTP " + res.status);
  return Buffer.from(await res.arrayBuffer());
}

async function cleanAndGetBuffer(input) {
  let buf = input;
  if (typeof input === "string" && /^https?:\/\//i.test(input)) {
    buf = await fImgBuf(input);
  }
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    throw new Error("Invalid image data");
  }
  return buf;
}

async function wrapText(image, font, text, width) {
  return image.print({ text, font, x: 0, y: 0, maxWidth: width });
}

async function applyEffect(input, effect, options = {}) {
  const buf = await cleanAndGetBuffer(input);
  let img = await Jimp.read(buf);

  switch (effect) {
    case "invert":
      img.invert();
      break;
    case "grayscale":
      img.greyscale();
      break;
    case "sepia":
      img.sepia();
      break;
    case "blur": {
      const px = Math.max(0, Math.min(50, parseInt(options.amount, 10) || 3));
      if (px > 0) img = await img.blur(px);
      break;
    }
    case "pixelate": {
      const px = Math.max(1, Math.min(50, parseInt(options.amount, 10) || 8));
      img.pixelate(px);
      break;
    }
    case "flip":
      img.flip({ horizontal: options.horizontal !== false, vertical: options.vertical === true });
      break;
    case "rotate": {
      const deg = parseFloat(options.amount) || 0;
      img = await img.rotate(deg);
      break;
    }
    case "contrast": {
      const val = (parseFloat(options.amount) || 50) / 100;
      img.contrast(val);
      break;
    }
    case "meme": {
      if (img.width > 1280) {
        const ratio = 1280 / img.width;
        img = await img.resize({ w: 1280, h: Math.round(img.height * ratio) });
      }
      const font = await getMemeFont();
      const textTop = (options.top || "").trim().toUpperCase();
      const textBottom = (options.bottom || "").trim().toUpperCase();
      const wrapWidth = img.width - 16;
      const printText = async (txt, y) => {
        const textImage = new Jimp({ width: img.width, height: img.height, color: 0x00000000 });
        await textImage.print({ font, text: txt, x: 4, y, maxWidth: wrapWidth });
        img = await img.composite(textImage, 0, 0);
      };
      if (textTop) {
        const barH = Math.min(
          Math.round(img.height * 0.4),
          Math.round(measureTextHeight(font, textTop, wrapWidth) * 1.2 + 10),
        );
        const bar = new Jimp({ width: img.width, height: barH, color: 0x000000ff });
        img = await img.composite(bar, 0, 0);
        await printText(textTop, 5);
      }
      if (textBottom) {
        const barH = Math.min(
          Math.round(img.height * 0.4),
          Math.round(measureTextHeight(font, textBottom, wrapWidth) * 1.2 + 10),
        );
        const bar = new Jimp({ width: img.width, height: barH, color: 0x000000ff });
        img = await img.composite(bar, 0, img.height - barH);
        await printText(textBottom, img.height - barH + 5);
      }
      break;
    }
    default:
      throw new Error(`Unknown effect: ${effect}`);
  }

  const mime = img.mime === "image/jpeg" ? "image/png" : img.mime || "image/png";
  return img.getBuffer(mime);
}

async function dcImgBuf(interaction) {
  const attachment =
    interaction.options.getAttachment("image") || interaction.options.getAttachment("file");
  if (attachment) {
    if (!/^image\//i.test(attachment.contentType || "")) {
      throw new Error("Attached file is not an image");
    }
    return fImgBuf(attachment.url);
  }
  const url = interaction.options.getString("url");
  if (url && /^https?:\/\//i.test(url)) {
    return fImgBuf(url);
  }
  throw new Error("Attach an image or provide an image URL");
}

module.exports = { Jimp, fImgBuf, applyEffect, dcImgBuf, wrapText };
