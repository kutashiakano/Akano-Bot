const chalk = require("chalk");
const moment = require("moment-timezone");
const PhoneNumber = require("awesome-phonenumber");

moment.tz.setDefault("Asia/Jakarta").locale("id");

const flat = {
  whatsapp: {
    color: "#25D366",
    accent: "#00E676"
  },
  telegram: {
    color: "#229ED9",
    accent: "#4FC3F7"
  },
  discord: {
    color: "#5865F2",
    accent: "#7986F5"
  }
};

const gray = chalk.gray;

const red = chalk.red;

const formatSize = size => {
  if (!size || isNaN(size) || size <= 0) return gray("-");
  if (size < 1e3) return gray(size + "B");
  if (size < 1e6) return gray((size / 1e3).toFixed(1) + "KB");
  if (size < 1e9) return gray((size / 1e6).toFixed(1) + "MB");
  return gray((size / 1e9).toFixed(1) + "GB");
};

const shortText = (t, max = 60) => {
  t = String(t || "").trim();
  if (!t) return gray("-");
  return t.length > max ? t.slice(0, max) + "..." : t;
};

const formatTime = ts => moment(ts).format("DD/MM/YY HH:mm:ss");

const shouldLog = isCmd => {
  try {
    const s = global.settings?.log;
    if (isCmd) return s?.commandLog !== false;
    return s?.chatLog === true;
  } catch {
    return false;
  }
};

const oneLine = (platform, sender, chat, msg) => {
  const tag = platform === "whatsapp" ? chalk.hex("#25D366")("[WA]") : platform === "telegram" ? chalk.hex("#229ED9")("[TG]") : chalk.hex("#5865F2")("[DC]");
  console.log(`${tag} ${sender} ${gray("→")} ${chat} ${gray("|")} ${msg}`);
};

const whatsappTypes = {
  conversation: "Message",
  extendedTextMessage: "Message",
  imageMessage: "Image",
  videoMessage: "Video",
  pollCreationMessageV3: "Poll",
  audioMessage: "Audio",
  stickerMessage: "Sticker",
  stickerPackMessage: "Sticker Pack",
  documentMessage: "Document",
  locationMessage: "Location",
  eventMessage: "Event",
  groupStatusMentionMessage: "Status Mention",
  contactMessage: "Contact",
  contactsArrayMessage: "Contact Array",
  groupInviteMessage: "Group Invite",
  listMessage: "List",
  buttonsMessage: "Buttons",
  templateMessage: "Template",
  viewOnceMessage: "ViewOnce",
  orderMessage: "Order",
  productMessage: "Product",
  catalogMessage: "Catalog"
};

const printWhatsapp = async (m, sock) => {
  if (!m) return;
  try {
    const t = flat.whatsapp;
    const main = chalk.hex(t.color);
    const accent = chalk.hex(t.accent);
    const color = s => main(s);
    let name = m.pushName || "";
    try {
      if (!name && m.sender) name = await (sock?.getName?.(m.sender).catch(() => "")) || "";
    } catch {}
    const number = m.sender ? PhoneNumber("+" + m.sender.replace("@s.whatsapp.net", "")).getNumber("international") : "";
    const senderLabel = name ? color("(" + name + ")") + " " + gray(number || m.sender || "unknown") : gray(number || m.sender || "unknown");
    let type = whatsappTypes[m?.mtype] || m?.mtype || "-";
    if (m?.msg?.ptt) type = "PTT";
    const typeLabel = m.isCmd ? gray(type) + " " + accent("(Command)") : gray(type);
    const size = formatSize(m.msg?.fileLength?.low || m.msg?.fileLength || m.text?.length);
    let raw = shortText(m.text);
    const msgLabel = m.error ? red(raw) : color(raw);
    if (!shouldLog(!!(m.isCommand || m.isCmd))) return;
    const chatLabel = m.chat ? String(m.chat).slice(0, 30) : "unknown";
    oneLine("whatsapp", senderLabel.replace(/\x1b\[[0-9;]*m/g, "").slice(0, 40), chatLabel, msgLabel.replace(/\x1b\[[0-9;]*m/g, "").slice(0, 70));
    if (typeof global.__botEvent === "function") {
      try {
        global.__botEvent({
          type: "message",
          data: {
            platform: "whatsapp",
            sender: name || number || m.sender,
            chat: m.chat,
            type: whatsappTypes[m?.mtype] || m?.mtype || "-",
            preview: String(m.text || "").slice(0, 160),
            isCommand: !!m.isCommand,
            command: m.command || null
          }
        });
      } catch {}
    }
  } catch (e) {
    console.error("print.js >", e.message);
  }
};

const telegramTypes = {
  text: "Text",
  photo: "Photo",
  video: "Video",
  animation: "GIF",
  audio: "Audio",
  voice: "Voice",
  video_note: "Video Note",
  document: "Document",
  sticker: "Sticker",
  poll: "Poll",
  location: "Location",
  contact: "Contact",
  new_chat_members: "Member Joined",
  left_chat_member: "Member Left"
};

const printTelegram = ctx => {
  const msg = ctx.message || {};
  if (!msg) return;
  try {
    const t = flat.telegram;
    const main = chalk.hex(t.color);
    const accent = chalk.hex(t.accent);
    const color = s => main(s);
    const from = ctx.from || {};
    const name = from.first_name || from.username || "Unknown";
    const senderLabel = color("(" + name + ")") + " " + gray(from.username ? "@" + from.username : from.id || "unknown");
    let type = telegramTypes[Object.keys(telegramTypes).find(k => msg[k])] || "Unknown";
    let size = 0;
    if (msg.document) size = msg.document.file_size; else if (msg.video) size = msg.video.file_size; else if (msg.audio) size = msg.audio.file_size; else if (msg.voice) size = msg.voice.file_size; else if (msg.photo?.length) size = msg.photo[msg.photo.length - 1].file_size;
    const typeLabel = ctx.message?.text?.startsWith("/") ? gray(type) + " " + accent("(Command)") : gray(type);
    const isGroup = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
    const isChannel = ctx.chat?.type === "channel";
    const chatLabel = isGroup ? "Group" : isChannel ? "Channel" : "Private";
    const chatRow = gray("• Chat     : ") + gray(chatLabel) + (ctx.chat?.title ? " " + color("(" + ctx.chat.title + ")") : "");
    const isCmd = !!msg.text?.startsWith("/") || !!msg.caption?.startsWith("/");
    if (!shouldLog(isCmd)) return;
    const chatName = ctx.chat?.title ? ctx.chat.title.slice(0, 25) : ctx.chat?.type || "Private";
    const cleanSender = senderLabel.replace(/\x1b\[[0-9;]*m/g, "");
    const cleanMsg = shortText(msg.text || msg.caption).replace(/\x1b\[[0-9;]*m/g, "");
    oneLine("telegram", cleanSender.slice(0, 35), chatName.slice(0, 25), cleanMsg.slice(0, 70));
    if (typeof global.__botEvent === "function") {
      try {
        global.__botEvent({
          type: "message",
          data: {
            platform: "telegram",
            sender: ctx.from && (ctx.from.username || ctx.from.first_name) || "unknown",
            chat: ctx.chat ? String(ctx.chat.id) : null,
            type: msg.media_group_id ? "Media" : telegramTypes[msg._type] || "Text",
            preview: String(msg.text || msg.caption || "").slice(0, 160),
            isCommand: !!ctx.match,
            command: ctx.match ? String(ctx.match[0]).split(" ")[0] : null
          }
        });
      } catch {}
    }
  } catch (e) {
    console.error("print.js >", e.message);
  }
};

const printDiscord = async ({interaction: interaction, message: message}) => {
  try {
    const t = flat.discord;
    const main = chalk.hex(t.color);
    const accent = chalk.hex(t.accent);
    const color = s => main(s);
    if (interaction) {
      const user = interaction.user || {};
      const name = user.displayName || user.username || "Unknown";
      const senderLabel = color("(" + name + ")") + " " + gray(user.id || "unknown");
      const guild = interaction.guild?.name;
      const chatRow = gray("• Chat     : ") + gray(interaction.guild ? "Server" : "DM") + (guild ? " " + color("(" + guild + (interaction.channel?.name ? " | #" + interaction.channel.name : "") + ")") : "");
      if (!interaction.commandName) {
        if (!shouldLog(false)) return;
        const cleanSender = senderLabel.replace(/\x1b\[[0-9;]*m/g, "");
        const guildName = interaction.guild?.name?.slice(0, 20) || "DM";
        oneLine("discord", cleanSender.slice(0, 30), guildName, shortText(interaction.customId || "").replace(/\x1b\[[0-9;]*m/g, "").slice(0, 50));
        return;
      }
      const args = (interaction.options?.data || []).map(o => o.value !== undefined && o.value !== null ? `${o.name}: ${o.value}` : o.name).join(", ");
      if (!shouldLog(true)) return;
      const cleanSender2 = senderLabel.replace(/\x1b\[[0-9;]*m/g, "");
      const guildName2 = interaction.guild?.name?.slice(0, 20) || "DM";
      oneLine("discord", cleanSender2.slice(0, 30), guildName2, ("/" + interaction.commandName + (args ? " " + args : "")).slice(0, 60));
      if (typeof global.__botEvent === "function") {
        try {
          global.__botEvent({
            type: "message",
            data: {
              platform: "discord",
              sender: interaction.user ? interaction.user.tag : "unknown",
              chat: interaction.guildId || interaction.channelId,
              type: "Slash Command",
              preview: "/" + interaction.commandName + (args ? " " + args : ""),
              isCommand: true,
              command: interaction.commandName
            }
          });
        } catch {}
      }
      return;
    }
    if (message) {
      const author = message.author || {};
      const name = author.displayName || author.username || "Unknown";
      const senderLabel = color("(" + name + ")") + " " + gray(author.id || "unknown");
      const guild = message.guild?.name;
      const chatRow = gray("• Chat     : ") + gray(message.guild ? "Server" : "DM") + (guild ? " " + color("(" + guild + (message.channel?.name ? " | #" + message.channel.name : "") + ")") : "");
      let type = "Message";
      let size = 0;
      const attachments = message.attachments?.size ? [ ...message.attachments.values() ] : [];
      if (attachments.length > 0) {
        const att = attachments[0];
        if (att.contentType?.startsWith("image/")) type = "Image"; else if (att.contentType?.startsWith("video/")) type = "Video"; else if (att.contentType?.startsWith("audio/")) type = "Audio"; else type = "File";
        size = att.size;
      } else if (message.stickers?.size > 0) {
        type = "Sticker";
      } else if (message.embeds?.length > 0) {
        type = "Embed";
      }
      const typeLabel = gray(type) + (attachments.length > 1 ? " " + gray("(" + attachments.length + " files)") : "");
      const isCmd = String(message.content || "").trim().startsWith("/");
      if (!shouldLog(isCmd)) return;
      const cleanSender3 = senderLabel.replace(/\x1b\[[0-9;]*m/g, "");
      const guildName3 = message.guild?.name?.slice(0, 20) || "DM";
      oneLine("discord", cleanSender3.slice(0, 30), guildName3, shortText(message.content).replace(/\x1b\[[0-9;]*m/g, "").slice(0, 60));
      if (typeof global.__botEvent === "function") {
        try {
          global.__botEvent({
            type: "message",
            data: {
              platform: "discord",
              sender: name + "#" + author.id,
              chat: message.guildId || message.channelId,
              type: type,
              preview: String(message.content || "").slice(0, 160),
              isCommand: false,
              command: null
            }
          });
        } catch {}
      }
    }
  } catch (e) {
    console.error("print.js >", e.message);
  }
};

module.exports = async input => {
  if (!input) return;
  if (input.type === "whatsapp") return printWhatsapp(input.m, input.sock);
  if (input.type === "telegram") return printTelegram(input.ctx);
  if (input.type === "discord") return printDiscord(input);
};