import sharp from "sharp";
import { resize as sdkResize } from "@kutashiakanocanzy/sdk";

async function fImgBuf(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });
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

function escXml(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function memeSvg(img, top, bottom) {
  const meta = await sharp(img).metadata();
  const w = meta.width || 512;
  const h = meta.height || 512;
  const barH = Math.min(Math.round(h * 0.22), 160);
  const fs = Math.max(20, Math.round(barH * 0.42));
  const parts = [];
  if (top) {
    parts.push(`<rect x="0" y="0" width="${w}" height="${barH}" fill="white"/>`);
    parts.push(`<text x="${w / 2}" y="${barH / 2}" font-family="sans-serif" font-size="${fs}" font-weight="bold" fill="black" text-anchor="middle" dominant-baseline="central">${escXml(top)}</text>`);
  }
  if (bottom) {
    parts.push(`<rect x="0" y="${h - barH}" width="${w}" height="${barH}" fill="white"/>`);
    parts.push(`<text x="${w / 2}" y="${h - barH / 2}" font-family="sans-serif" font-size="${fs}" font-weight="bold" fill="black" text-anchor="middle" dominant-baseline="central">${escXml(bottom)}</text>`);
  }
  return { svg: Buffer.from(`<svg width="${w}" height="${h}">${parts.join("")}</svg>`), w: w, h: h };
}

async function applyEffect(input, effect, options = {}) {
  const buf = await cleanAndGetBuffer(input);
  switch (effect) {
    case "invert":
      return sharp(buf).negate().png().toBuffer();

    case "grayscale":
      return sharp(buf).grayscale().png().toBuffer();

    case "sepia":
      return sharp(buf).recomb([[0.393, 0.769, 0.189], [0.349, 0.686, 0.168], [0.272, 0.534, 0.131]]).png().toBuffer();

    case "blur": {
      const px = Math.max(0, Math.min(50, parseInt(options.amount, 10) || 3));
      let s = sharp(buf);
      if (px > 0) s = s.blur(px);
      return s.png().toBuffer();
    }

    case "pixelate": {
      const px = Math.max(1, Math.min(50, parseInt(options.amount, 10) || 8));
      const meta = await sharp(buf).metadata();
      const w = meta.width || 256;
      const h = meta.height || 256;
      const sw = Math.max(1, Math.round(w / px));
      const sh = Math.max(1, Math.round(h / px));
      return sharp(buf).resize(sw, sh, { kernel: "nearest" }).resize(w, h, { kernel: "nearest" }).png().toBuffer();
    }

    case "flip": {
      let s = sharp(buf);
      if (options.horizontal !== false) s = s.flop();
      if (options.vertical === true) s = s.flip();
      return s.png().toBuffer();
    }

    case "rotate": {
      const deg = parseFloat(options.amount) || 0;
      return sharp(buf).rotate(deg).png().toBuffer();
    }

    case "contrast": {
      const val = Math.max(-1, Math.min(1, (parseFloat(options.amount) || 50) / 100));
      return sharp(buf).linear(1 + val, -(128 * val)).png().toBuffer();
    }

    case "meme": {
      let base = buf;
      try {
        const meta = await sharp(buf).metadata();
        if ((meta.width || 0) > 1280) {
          const small = await sdkResize(buf, 1280, Math.round((meta.height || 720) * 1280 / meta.width));
          if (small) base = small;
        }
      } catch {}
      const textTop = (options.top || "").trim().toUpperCase().slice(0, 120);
      const textBottom = (options.bottom || "").trim().toUpperCase().slice(0, 120);
      if (!textTop && !textBottom) return sharp(base).png().toBuffer();
      const { svg } = await memeSvg(base, textTop, textBottom);
      return sharp(base).composite([{ input: svg, top: 0, left: 0 }]).png().toBuffer();
    }

    default:
      throw new Error(`Unknown effect: ${effect}`);
  }
}

async function dcImgBuf(interaction) {
  const attachment = interaction.options.getAttachment("image") || interaction.options.getAttachment("file");
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

export {
  fImgBuf,
  applyEffect,
  dcImgBuf
};
