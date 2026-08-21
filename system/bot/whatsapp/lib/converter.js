const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const crypto = require("crypto");
const { Image } = require("node-webpmux");

function ffmpeg(buffer, args = [], ext = "", ext2 = "") {
  return new Promise(async (resolve, reject) => {
    try {
      let tmp = path.join(__dirname, "../tmp", +new Date() + "." + ext);
      let out = tmp + "." + ext2;
      await fs.promises.writeFile(tmp, buffer);
      spawn("ffmpeg", ["-y", "-i", tmp, ...args, out], { env: getSpawnEnv() })
        .on("error", reject)
        .on("close", async (code) => {
          try {
            await fs.promises.unlink(tmp);
            if (code !== 0) return reject(code);
            resolve({ data: await fs.promises.readFile(out), filename: out });
          } catch (e) {
            reject(e);
          }
        });
    } catch (e) {
      reject(e);
    }
  });
}

function toPTT(buffer, ext) {
  return ffmpeg(buffer, ["-vn", "-c:a", "libopus", "-b:a", "128k", "-vbr", "on"], ext, "ogg");
}

function toAudio(buffer, ext) {
  return ffmpeg(
    buffer,
    ["-vn", "-c:a", "libopus", "-b:a", "128k", "-vbr", "on", "-compression_level", "10"],
    ext,
    "opus",
  );
}

function toVideo(buffer, ext) {
  return ffmpeg(
    buffer,
    [
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-ab",
      "128k",
      "-ar",
      "44100",
      "-crf",
      "32",
      "-preset",
      "slow",
    ],
    ext,
    "mp4",
  );
}

async function addExif(webpBuffer, packname, author, categories = [""], extra = {}) {
  const img = new Image();
  const stickerPackId = crypto.randomBytes(32).toString("hex");
  const json = {
    "sticker-pack-id": stickerPackId,
    "sticker-pack-name": packname || "Sticker",
    "sticker-pack-publisher": author || "Bot",
    emojis: categories,
    ...extra,
  };
  const jsonBuffer = Buffer.from(JSON.stringify(json), "utf8");
  let exifAttr = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
  ]);
  const exif = Buffer.concat([exifAttr, jsonBuffer]);
  exif.writeUIntLE(jsonBuffer.length, 14, 4);
  await img.load(webpBuffer);
  img.exif = exif;
  return await img.save(null);
}

function getSpawnEnv() {
  const env = { ...process.env };
  if (process.platform === "linux" && env.HOME) {
    const localBin = path.join(env.HOME, ".local", "bin");
    const termuxBin = "/data/data/com.termux/files/usr/bin";
    env.PATH = `${termuxBin}:${localBin}:${env.PATH}`;
  }
  return env;
}

function getMediaDuration(buffer, ext) {
  return new Promise((resolve) => {
    const tmpFile = path.join(__dirname, "../tmp", `_dur_${Date.now()}.${ext}`);
    fs.writeFileSync(tmpFile, buffer);
    spawn(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", tmpFile],
      { env: getSpawnEnv() },
    )
      .on("error", () => {
        try {
          fs.unlinkSync(tmpFile);
        } catch {}
        resolve(6);
      })
      .on("close", (code, stdout) => {
        try {
          fs.unlinkSync(tmpFile);
        } catch {}
        const dur = parseFloat(stdout?.trim());
        resolve(isNaN(dur) ? 6 : Math.min(dur, 6));
      });
  });
}

async function sticker(buffer, options = {}) {
  const { packname = "Sticker", author = "Bot" } = options;

  const isGif = buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46;
  const isMp4 = buffer.includes(Buffer.from("ftypmp4")) || buffer.includes(Buffer.from("ftypisom"));
  const isAnimated = isGif || isMp4;

  return new Promise(async (resolve, reject) => {
    try {
      const tmpDir = path.join(__dirname, "../tmp");
      await fs.promises.mkdir(tmpDir, { recursive: true });
      const ts = Date.now();
      const tmpIn = path.join(tmpDir, `stk_${ts}`);
      const tmpOut = path.join(tmpDir, `stk_${ts}.webp`);

      let ext = "png";
      if (isAnimated) ext = isGif ? "gif" : "mp4";
      else {
        if (buffer[0] === 0xff && buffer[1] === 0xd8) ext = "jpg";
        else if (buffer[0] === 0x89 && buffer[1] === 0x50) ext = "png";
      }

      const inputFile = `${tmpIn}.${ext}`;
      await fs.promises.writeFile(inputFile, buffer);

      let args;
      if (isAnimated) {
        const duration = await getMediaDuration(buffer, ext);
        args = [
          "-y",
          "-i",
          inputFile,
          "-vcodec",
          "libwebp",
          "-vf",
          "scale=512:512:force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=0x00000000,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=000000[p];[b][p]paletteuse",
          "-loop",
          "0",
          "-t",
          String(Math.min(duration, 6)),
          "-preset",
          "default",
          "-an",
          "-pix_fmt",
          "yuva420p",
          tmpOut,
        ];
      } else {
        args = [
          "-y",
          "-i",
          inputFile,
          "-vcodec",
          "libwebp",
          "-vf",
          "scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:-1:-1:color=0x00000000,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=000000[p];[b][p]paletteuse",
          "-lossless",
          "0",
          "-compression_level",
          "6",
          "-quality",
          "80",
          "-loop",
          "0",
          "-an",
          "-pix_fmt",
          "yuva420p",
          tmpOut,
        ];
      }

      spawn("ffmpeg", args, { env: getSpawnEnv() })
        .on("error", reject)
        .on("close", async (code, stderr) => {
          try {
            await fs.promises.unlink(inputFile).catch(() => {});
            if (code !== 0) {
              console.log("[STICKER FFmpeg]", stderr);
              return reject(new Error("FFmpeg failed code " + code));
            }

            const webpBuf = await fs.promises.readFile(tmpOut);
            await fs.promises.unlink(tmpOut).catch(() => {});

            try {
              const result = await addExif(webpBuf, packname, author);
              resolve(result);
            } catch (e) {
              console.error(e);
              resolve(webpBuf);
            }
          } catch (e) {
            reject(e);
          }
        });
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = {
  toAudio,
  toPTT,
  toVideo,
  ffmpeg,
  sticker,
  addExif,
};
