const { Jimp } = require("jimp");
const fetch = require("node-fetch");
const moment = require("moment-timezone");

function isNumber(x) {
  const parsed = parseInt(x);
  return typeof parsed === "number" && !isNaN(parsed);
}

function getRandom(list) {
  if (Array.isArray(list) || typeof list === "string") {
    return list[Math.floor(Math.random() * list.length)];
  }
  return Math.floor(Math.random() * list);
}

function rand(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function parseMention(text = "") {
  if (!text || typeof text !== "string") return [];
  return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(
    (v) => v[1] + "@s.whatsapp.net"
  );
}

async function resize(image, width, height) {
  const img = await Jimp.read(image);
  img.resize({ w: width, h: height });
  const mime = img.mime || "image/jpeg";
  const buffer = await img.getBuffer(mime);
  return buffer;
}

function formatSize(size) {
  if (!size) return "";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(size) / Math.log(1024));
  return `${(size / Math.pow(1024, i)).toFixed(1)}${units[i]}`;
}

function formatDate(ts) {
  return moment(ts * 1000).tz("Asia/Jakarta").format("DD/MM/YY");
}

function formatTime(ts) {
  return moment(ts * 1000).tz("Asia/Jakarta").format("HH:mm:ss");
}

async function downloadStatus(m, sock) {
  let key;
  try {
    await m.react("⏳").catch(() => {});
    const res = await m.reply("```Status: Waiting...```");
    key = res?.key;
  } catch (e) {
    console.error("Status initialization error:", e);
  }

  return {
    async processing() {
      if (key) {
        await m.react("🔄").catch(() => {});
        await sock.sendMessage(m.chat, { text: "```Status: Processing...```", edit: key }).catch(() => {});
      }
    },
    async success() {
      if (key) {
        await m.react("✅").catch(() => {});
        await sock.sendMessage(m.chat, { text: "```Status: Success!```", edit: key }).catch(() => {});
      }
    },
    async failed(err) {
      if (key) {
        await m.react("❌").catch(() => {});
        const errorMsg = err?.message || String(err);
        await sock.sendMessage(m.chat, { text: "\u0060\u0060\u0060Status: Failed!\nReason: " + errorMsg + "\u0060\u0060\u0060", edit: key }).catch(() => {});
      }
    }
  };
}

module.exports = {
  isNumber,
  getRandom,
  rand,
  parseMention,
  resize,
  formatSize,
  formatDate,
  formatTime,
  downloadStatus
};
