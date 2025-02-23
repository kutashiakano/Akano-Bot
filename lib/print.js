const chalk = require("chalk");
const gradient = require("gradient-string");
const fs = require("fs");
const moment = require("moment-timezone");
const PhoneNumber = require("awesome-phonenumber");

moment.tz.setDefault("Asia/Jakarta").locale("id");

const color = {
  cmd: chalk.yellow,
  msg: chalk.yellow,
  time: chalk.yellow,
  name: chalk.yellow,
  type: chalk.yellow,
  chat: chalk.yellow,
  text: chalk.yellow,
};

const formatTime = (timestamp) => {
  return moment(timestamp * 1000).format("DD/MM/YY HH:mm:ss");
};

const formatPhone = (jid, username = "") => {
  if (!jid) return "[Unknown]";
  const number = PhoneNumber(
    "+" + jid.replace("@s.whatsapp.net", ""),
  ).getNumber("international");
  return `[${number}]${username ? ` ${username}` : ""}`;
};

const getMsgType = (m) => {
  if (!m) return "Unknown";
  let type = "Text";
  if (m.mtype === "conversation" || m.mtype === "extendedTextMessage")
    type = "Text";
  else if (m.mtype === "imageMessage") type = "Image";
  else if (m.mtype === "videoMessage") type = "Video";
  else if (m.mtype === "pollCreationMessageV3") type = "Polling";
  else if (m.mtype === "audioMessage") type = "Audio";
  else if (/gifPlayback/.test(m.mtype)) type = "Gif";
  else if (m.mtype === "stickerMessage") type = "Sticker";
  else if (m.mtype === "stickerPackMessage") type = "StickerPack";
  else if (m.mtype === "documentMessage") type = "Document";
  else if (m.mtype === "locationMessage") type = "Location";
  else if (m.mtype === "eventMessage") type = "Event";
  else if (m.mtype === "groupStatusMentionMessage") type = "StatusMention";
  else if (m.chat?.endsWith("@newsletter")) type = "Channel";
  else if (m.msg?.vcard) type = "Contact";
  return type;
};

const getFileSize = (m) => {
  const size =
    m.msg?.fileLength?.low || m.msg?.fileLength || m.text?.length || 0;
  if (size === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exp = Math.floor(Math.log(size) / Math.log(1024));
  const formattedSize = (size / Math.pow(1024, exp)).toFixed(1);
  return `${formattedSize} ${units[exp]}`;
};

const createMessageBox = async (m, sock, myPrefix) => {
  try {
    const who = m.fromMe ? "Self" : m.pushName || "No Name";
    const time = formatTime(m.messageTimestamp);
    const msgType = getMsgType(m);
    const fileSize = getFileSize(m);
    const sender = formatPhone(m.sender, who);

    let chatInfo = "";
    if (m.isGroup && sock?.groupMetadata) {
      try {
        const groupMeta = await sock.groupMetadata(m.chat);
        chatInfo = ` ${color.chat(groupMeta.subject)}`;
      } catch {
        chatInfo = ` ${color.name("[Group]")}`;
      }
    }

    const messageType = m.isCmd ? "CMD" : "MSG";
    const header = `\n${color.cmd(`[${messageType}]`)} ${color.time(time)} ${color.type(msgType)}`;
    const senderInfo = `from ${sender}${chatInfo}`;
    const content = m.text ? `\n${color.text(m.text)}` : "";
    const fileInfo = fileSize !== "0 B" ? ` [${fileSize}]` : "";

    return `${header} ${senderInfo}${fileInfo}${content}\n`;
  } catch (e) {
    return "\n[Error]\n";
  }
};

module.exports = async (m, sock = {}, myPrefix) => {
  if (!m) return;
  const messageBox = await createMessageBox(m, sock, myPrefix);
  console.log(messageBox);
};

const file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(gradient.passion(`Update: ${file}`));
  delete require.cache[file];
  if (global.reloadHandler) {
    global.reloadHandler();
    console.log(gradient.summer("Handler Reloaded"));
  }
});
