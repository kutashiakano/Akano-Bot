import moment from "moment-timezone";
import { resize as sdkResize } from "@kutashiakanocanzy/sdk";

async function resize(image, width, height) {
  return await sdkResize(image, width, height);
}

function formatDate(ts) {
  return moment(ts * 1e3).tz("Asia/Jakarta").format("DD/MM/YY");
}

function formatTime(ts) {
  return moment(ts * 1e3).tz("Asia/Jakarta").format("HH:mm:ss");
}

async function downloadStatus(m, sock) {
  let key;
  try {
    await m.react("").catch(() => {});
    const res = await m.reply("```Status: Waiting...```");
    key = res?.key;
  } catch (e) {
    console.error("Status initialization error:", e);
  }
  return {
    async processing() {
      if (key) {
        await m.react("").catch(() => {});
        await sock.sendMessage(m.chat, {
          text: "```Status: Processing...```",
          edit: key
        }).catch(() => {});
      }
    },
    async success() {
      if (key) {
        await m.react("").catch(() => {});
        await sock.sendMessage(m.chat, {
          text: "```Status: Success!```",
          edit: key
        }).catch(() => {});
      }
    },
    async failed(err) {
      if (key) {
        await m.react("").catch(() => {});
        const errorMsg = err?.message || String(err);
        await sock.sendMessage(m.chat, {
          text: "```Status: Failed!\nReason: " + errorMsg + "```",
          edit: key
        }).catch(() => {});
      }
    }
  };
}

export { resize, formatDate, formatTime, downloadStatus };
