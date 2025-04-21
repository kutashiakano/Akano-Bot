const chalk = require("chalk");
const moment = require("moment-timezone");
const PhoneNumber = require("awesome-phonenumber");
const gradient = require("gradient-string");

moment.tz.setDefault("Asia/Jakarta").locale("id");

const theme = {
    border: gradient(['#FF69B4', '#FF1493']),
    utc: gradient(['#00FFFF', '#40E0D0']),
    user: gradient(['#FFB6C1', '#FF69B4']),
    date: gradient(['#FFA07A', '#FF6347']),
    time: gradient(['#98FB98', '#90EE90']),
    type: gradient(['#DDA0DD', '#DA70D6']),
    chat: gradient(['#87CEEB', '#00BFFF']),
    sender: gradient(['#FFD700', '#FFA500']),
    content: chalk.hex('#F0F8FF')
};

const formatTime = ts => moment(ts * 1000).format("HH:mm:ss");
const formatDate = ts => moment(ts * 1000).format("DD/MM/YY");
const formatUTC = () => moment().utc().format("YYYY-MM-DD HH:mm:ss");

const formatSender = async (m, sock) => {
    if (m.chat?.endsWith("@newsletter")) {
        const meta = await sock.newsletterMetadata("jid", m.chat);
        return meta?.name || "Unknown";
    }
    const who = m.fromMe ? "Self" : m.pushName || "Unknown";
    const number = PhoneNumber("+" + m.sender.replace("@s.whatsapp.net", "")).getNumber("international");
    return `${who} (${number})`;
};

const getMsgType = m => {
    const types = {
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
    return types[m?.mtype] || m?.mtype || "Unknown";
};

const formatSize = size => {
    if (!size) return "";
    const units = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(size) / Math.log(1024));
    return `${(size / Math.pow(1024, i)).toFixed(1)}${units[i]}`;
};

const createLog = async (m, sock) => {
    const border = theme.border("─".repeat(50));
    const time = formatTime(m.messageTimestamp);
    const date = formatDate(m.messageTimestamp);
    const type = getMsgType(m);
    const size = formatSize(m.msg?.fileLength?.low || m.msg?.fileLength || m.text?.length);
    const sender = await formatSender(m, sock);
    const chatType = m.chat?.endsWith("@newsletter") ? "Channel" : m.isGroup ? "Group" : "Private";

    let log = `${border}\n`;
    log += `${theme.utc(`UTC: ${formatUTC()}`)}\n`;
    log += `${theme.date(date)} ${theme.time(time)}\n`;
    log += `${theme.type(`Type: ${type}`)}${size ? ` | ${size}` : ''}\n`;
    log += `${theme.chat(`Chat: ${chatType}`)} `;
    
    if (m.isGroup) {
        const group = await sock.groupMetadata(m.chat);
        log += `| ${theme.chat(group.subject)}`;
    }
    
    log += `\n${theme.sender(`From: ${sender}`)}\n`;

    if (m.text) {
        log += `${theme.content(m.text)}\n`;
    }

    log += border;
    return log + "\n";
};

module.exports = async (m, sock = {}) => {
    if (!m) return;
    console.log(await createLog(m, sock));
};