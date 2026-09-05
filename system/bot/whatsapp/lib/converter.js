const fs = require("fs");
const path = require("path");
const {spawn: spawn} = require("child_process");
const crypto = require("crypto");
const {Image: Image} = require("node-webpmux");
const {Readable: Readable} = require("stream");

const TMP_DIR = path.join(__dirname, "../../../../tmp");

const MAX_INPUT_SIZE = 50 * 1024 * 1024;

try {
  fs.mkdirSync(TMP_DIR, {
    recursive: true
  });
} catch {}

function isReadableStream(obj) {
  return obj !== null && typeof obj === "object" && typeof obj.pipe === "function" && typeof obj.read === "function" && typeof obj.on === "function" || obj instanceof Readable;
}

function saveStreamToFile(stream, filePath) {
  return new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(filePath);
    stream.pipe(ws);
    ws.on("finish", resolve);
    ws.on("error", reject);
    stream.on("error", reject);
  });
}

function getSpawnEnv() {
  const env = {
    ...process.env
  };
  if (process.platform === "linux" && env.HOME) {
    const localBin = path.join(env.HOME, ".local", "bin");
    const termuxBin = "/data/data/com.termux/files/usr/bin";
    env.PATH = `${termuxBin}:${localBin}:${env.PATH}`;
  }
  return env;
}

async function runFfmpeg(args, opts = {}) {
  const heavy = (() => {
    try {
      return require("../../../core/heavy");
    } catch {
      return null;
    }
  })();
  if (heavy && typeof heavy.execWithFallback === "function") {
    try {
      const res = await heavy.execWithFallback("ffmpeg", args, opts.cwd || process.cwd());
      if (res.code === 0) return;
      throw new Error(res.stderr || `ffmpeg exited ${res.code}`);
    } catch (e) {
      if (!String(e.message).includes("ffmpeg")) throw e;
    }
  }
  await new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args, {
      env: getSpawnEnv()
    });
    let stderr = "";
    proc.stderr.on("data", d => {
      stderr += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", code => {
      if (code === 0) resolve(); else reject(new Error(stderr || `ffmpeg exited ${code}`));
    });
  });
}

async function runFfprobe(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffprobe", args, {
      env: getSpawnEnv()
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", d => {
      stdout += d.toString();
    });
    proc.stderr.on("data", d => {
      stderr += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", code => {
      if (code === 0) resolve(stdout); else reject(new Error(stderr || `ffprobe ${code}`));
    });
  });
}

async function ffmpeg(bufferOrStream, args = [], ext = "", ext2 = "", opts = {}) {
  const isAudio = opts.isAudio || false;
  const tmpBase = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const tmp = path.join(TMP_DIR, `${tmpBase}.${ext || "bin"}`);
  const out = `${tmp}.${ext2 || "out"}`;
  let tmpCreated = false;
  let outCreated = false;
  try {
    await fs.promises.mkdir(TMP_DIR, {
      recursive: true
    });
    const isStream = isReadableStream(bufferOrStream);
    if (isStream) {
      await saveStreamToFile(bufferOrStream, tmp);
    } else {
      if (!Buffer.isBuffer(bufferOrStream)) {
        throw new Error("ffmpeg: input must be Buffer or Readable Stream");
      }
      await fs.promises.writeFile(tmp, bufferOrStream);
    }
    tmpCreated = true;
    if (isAudio) {
      try {
        const stat = await fs.promises.stat(tmp);
        if (stat.size > MAX_INPUT_SIZE) {
          const preOut = `${tmp}.pre.mp3`;
          try {
            await runFfmpeg([ "-y", "-i", tmp, "-vn", "-c:a", "libmp3lame", "-b:a", "96k", preOut ]);
            await fs.promises.unlink(tmp).catch(() => {});
            await fs.promises.rename(preOut, tmp).catch(async () => {
              try {
                await fs.promises.copyFile(preOut, tmp);
                await fs.promises.unlink(preOut);
              } catch {}
            });
          } catch (e) {
            await fs.promises.unlink(preOut).catch(() => {});
          }
        }
      } catch {}
    }
    const ffmpegArgs = [ "-y", "-i", tmp, ...args, out ];
    await runFfmpeg(ffmpegArgs);
    outCreated = true;
    await fs.promises.unlink(tmp).catch(() => {});
    tmpCreated = false;
    const dataStream = fs.createReadStream(out);
    const result = {
      data: dataStream,
      filename: out,
      async toBuffer() {
        const bufs = [];
        const rs = fs.createReadStream(out);
        for await (const chunk of rs) bufs.push(chunk);
        return Buffer.concat(bufs);
      },
      async clear() {
        try {
          dataStream.destroy();
        } catch {}
        await fs.promises.unlink(out).catch(() => {});
      },
      get buffer() {
        try {
          return fs.readFileSync(out);
        } catch {
          return Buffer.alloc(0);
        }
      }
    };
    try {
      const buf = await fs.promises.readFile(out);
      result.data = buf;
      result.stream = dataStream;
      const cachedBuf = buf;
      result.toBuffer = async () => cachedBuf;
      const origClear = result.clear;
      result.clear = async () => {
        try {
          dataStream.destroy();
        } catch {}
        await fs.promises.unlink(out).catch(() => {});
      };
    } catch {}
    return result;
  } catch (e) {
    if (tmpCreated) await fs.promises.unlink(tmp).catch(() => {});
    if (outCreated) await fs.promises.unlink(out).catch(() => {});
    try {
      await fs.promises.unlink(out).catch(() => {});
    } catch {}
    throw e;
  }
}

function toPTT(buffer, ext) {
  return ffmpeg(buffer, [ "-vn", "-c:a", "libopus", "-b:a", "128k", "-vbr", "on" ], ext, "ogg", {
    isAudio: true
  });
}

function toAudio(buffer, ext) {
  return ffmpeg(buffer, [ "-vn", "-c:a", "libopus", "-b:a", "128k", "-vbr", "on", "-compression_level", "10" ], ext, "opus", {
    isAudio: true
  });
}

function toVideo(buffer, ext) {
  return ffmpeg(buffer, [ "-c:v", "libx264", "-c:a", "aac", "-ab", "128k", "-ar", "44100", "-crf", "32", "-preset", "slow" ], ext, "mp4");
}

function makeExif(packname, author, categories = [ "" ], extra = {}) {
  const json = {
    "sticker-pack-id": "https://github.com/kutashiakano/Akano-Bot",
    "sticker-pack-name": packname || "Sticker",
    "sticker-pack-publisher": author || "Bot",
    emojis: categories,
    ...extra
  };
  const jsonBuffer = Buffer.from(JSON.stringify(json), "utf8");
  const exifAttr = Buffer.from([ 73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 65, 87, 7, 0, 0, 0, 0, 0, 22, 0, 0, 0 ]);
  const exif = Buffer.concat([ exifAttr, jsonBuffer ]);
  exif.writeUIntLE(jsonBuffer.length, 14, 4);
  return exif;
}

async function addExif(webpBuffer, packname, author, categories = [ "" ], extra = {}) {
  const img = new Image;
  await img.load(webpBuffer);
  img.exif = makeExif(packname, author, categories, extra);
  return await img.save(null);
}

function getMediaDuration(buffer, ext) {
  return new Promise(async resolve => {
    const tmpFile = path.join(TMP_DIR, `_dur_${Date.now()}_${crypto.randomBytes(3).toString("hex")}.${ext}`);
    try {
      await fs.promises.writeFile(tmpFile, buffer);
    } catch {
      return resolve(6);
    }
    try {
      const out = await runFfprobe([ "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", tmpFile ]);
      try {
        await fs.promises.unlink(tmpFile);
      } catch {}
      const dur = parseFloat(String(out).trim());
      resolve(isNaN(dur) ? 6 : Math.min(dur, 6));
    } catch {
      try {
        await fs.promises.unlink(tmpFile);
      } catch {}
      resolve(6);
    }
  });
}

async function sticker(buffer, options = {}) {
  const {packname: packname = "Sticker", author: author = "Bot"} = options;
  const isGif = buffer[0] === 71 && buffer[1] === 73 && buffer[2] === 70;
  const isMp4 = buffer.includes(Buffer.from("ftypmp4")) || buffer.includes(Buffer.from("ftypisom"));
  const isAnimated = isGif || isMp4;
  const tmpDir = TMP_DIR;
  await fs.promises.mkdir(tmpDir, {
    recursive: true
  });
  const ts = `${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  const tmpInBase = path.join(tmpDir, `stk_${ts}`);
  const tmpOut = path.join(tmpDir, `stk_${ts}.webp`);
  let ext = "png";
  if (isAnimated) ext = isGif ? "gif" : "mp4"; else {
    if (buffer[0] === 255 && buffer[1] === 216) ext = "jpg"; else if (buffer[0] === 137 && buffer[1] === 80) ext = "png";
  }
  const inputFile = `${tmpInBase}.${ext}`;
  await fs.promises.writeFile(inputFile, buffer);
  let args;
  if (isAnimated) {
    const duration = await getMediaDuration(buffer, ext);
    args = [ "-y", "-i", inputFile, "-vcodec", "libwebp", "-vf", "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=0x00000000,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=000000[p];[b][p]paletteuse", "-loop", "0", "-t", String(Math.min(duration, 6)), "-preset", "default", "-an", "-pix_fmt", "yuva420p", tmpOut ];
  } else {
    args = [ "-y", "-i", inputFile, "-vcodec", "libwebp", "-vf", "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:-1:-1:color=0x00000000,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=000000[p];[b][p]paletteuse", "-lossless", "0", "-compression_level", "6", "-quality", "80", "-loop", "0", "-an", "-pix_fmt", "yuva420p", tmpOut ];
  }
  try {
    await runFfmpeg(args);
  } catch (e) {
    await fs.promises.unlink(inputFile).catch(() => {});
    await fs.promises.unlink(tmpOut).catch(() => {});
    throw e;
  }
  await fs.promises.unlink(inputFile).catch(() => {});
  let webpBuf;
  try {
    webpBuf = await fs.promises.readFile(tmpOut);
  } catch (e) {
    await fs.promises.unlink(tmpOut).catch(() => {});
    throw e;
  }
  await fs.promises.unlink(tmpOut).catch(() => {});
  try {
    const result = await addExif(webpBuf, packname, author);
    return result;
  } catch (e) {
    console.error(e);
    return webpBuf;
  }
}

module.exports = {
  toAudio: toAudio,
  toPTT: toPTT,
  toVideo: toVideo,
  ffmpeg: ffmpeg,
  sticker: sticker,
  addExif: addExif,
  makeExif: makeExif,
  isReadableStream: isReadableStream,
  saveStreamToFile: saveStreamToFile,
  getSpawnEnv: getSpawnEnv,
  runFfmpeg: runFfmpeg
};