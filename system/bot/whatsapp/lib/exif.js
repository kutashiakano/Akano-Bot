const fs = require("fs");
const {tmpdir: tmpdir} = require("os");
const ff = require("fluent-ffmpeg");
const webp = require("node-webpmux");
const path = require("path");

const makeid = length => {
  let result = "";
  let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let charactersLength = characters.length;
  for (let i = 0; i < length; i++) result += characters.charAt(Math.floor(Math.random() * charactersLength));
  return result;
};

function makeExif(packname, author, categories) {
  const json = {
    "sticker-pack-id": `https://github.com/kutashiakano/Akano-Bot`,
    "sticker-pack-name": packname,
    "sticker-pack-publisher": author,
    emojis: categories ? categories : [ "" ]
  };
  const exifAttr = Buffer.from([ 73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 65, 87, 7, 0, 0, 0, 0, 0, 22, 0, 0, 0 ]);
  const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
  const exif = Buffer.concat([ exifAttr, jsonBuff ]);
  exif.writeUIntLE(jsonBuff.length, 14, 4);
  return exif;
}

async function imageToWebp(media) {
  const tmpFileOut = path.join(tmpdir(), `${makeid(10)}.webp`);
  const tmpFileIn = path.join(tmpdir(), `${makeid(10)}.jpg`);
  fs.writeFileSync(tmpFileIn, media);
  await new Promise((resolve, reject) => {
    ff(tmpFileIn).on("error", reject).on("end", () => resolve(true)).addOutputOptions([ "-vcodec", "libwebp", "-vf", "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse" ]).toFormat("webp").save(tmpFileOut);
  });
  const buff = fs.readFileSync(tmpFileOut);
  fs.unlinkSync(tmpFileOut);
  fs.unlinkSync(tmpFileIn);
  return buff;
}

async function videoToWebp(media) {
  const tmpFileOut = path.join(tmpdir(), `${makeid(10)}.webp`);
  const tmpFileIn = path.join(tmpdir(), `${makeid(10)}.mp4`);
  fs.writeFileSync(tmpFileIn, media);
  await new Promise((resolve, reject) => {
    ff(tmpFileIn).on("error", reject).on("end", () => resolve(true)).addOutputOptions([ "-vcodec", "libwebp", "-vf", "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15, pad=320:320:-1:-1:color=white@0.0, split [a][b]; [a] palettegen=reserve_transparent=on:transparency_color=ffffff [p]; [b][p] paletteuse", "-loop", "0", "-ss", "00:00:00", "-t", "00:00:05", "-preset", "default", "-an", "-vsync", "0" ]).toFormat("webp").save(tmpFileOut);
  });
  const buff = fs.readFileSync(tmpFileOut);
  fs.unlinkSync(tmpFileOut);
  fs.unlinkSync(tmpFileIn);
  return buff;
}

async function writeExifImg(media, metadata) {
  let wMedia = await imageToWebp(media);
  const tmpFileIn = path.join(tmpdir(), `${makeid(10)}.webp`);
  const tmpFileOut = path.join(tmpdir(), `${makeid(10)}.webp`);
  fs.writeFileSync(tmpFileIn, wMedia);
  if (metadata.packname || metadata.author) {
    const img = new webp.Image;
    await img.load(tmpFileIn);
    img.exif = makeExif(metadata.packname, metadata.author, metadata.categories);
    try {
      fs.unlinkSync(tmpFileIn);
    } catch {}
    await img.save(tmpFileOut);
    return tmpFileOut;
  }
  return tmpFileIn;
}

async function writeExifVid(media, metadata) {
  let wMedia = await videoToWebp(media);
  const tmpFileIn = path.join(tmpdir(), `${makeid(10)}.webp`);
  const tmpFileOut = path.join(tmpdir(), `${makeid(10)}.webp`);
  fs.writeFileSync(tmpFileIn, wMedia);
  if (metadata.packname || metadata.author) {
    const img = new webp.Image;
    await img.load(tmpFileIn);
    img.exif = makeExif(metadata.packname, metadata.author, metadata.categories);
    try {
      fs.unlinkSync(tmpFileIn);
    } catch {}
    await img.save(tmpFileOut);
    return tmpFileOut;
  }
  return tmpFileIn;
}

async function writeExif(media, metadata) {
  let wMedia = /webp/.test(media.mimetype) ? media.data : /image/.test(media.mimetype) ? await imageToWebp(media.data) : /video/.test(media.mimetype) ? await videoToWebp(media.data) : "";
  const tmpFileIn = path.join(tmpdir(), `${makeid(10)}.webp`);
  const tmpFileOut = path.join(tmpdir(), `${makeid(10)}.webp`);
  fs.writeFileSync(tmpFileIn, wMedia);
  if (metadata.packname || metadata.author) {
    const img = new webp.Image;
    await img.load(tmpFileIn);
    img.exif = makeExif(metadata.packname, metadata.author, metadata.categories);
    try {
      fs.unlinkSync(tmpFileIn);
    } catch {}
    await img.save(tmpFileOut);
    return tmpFileOut;
  }
  return tmpFileIn;
}

module.exports = {
  imageToWebp: imageToWebp,
  videoToWebp: videoToWebp,
  writeExifImg: writeExifImg,
  writeExifVid: writeExifVid,
  writeExif: writeExif,
  makeExif: makeExif
};