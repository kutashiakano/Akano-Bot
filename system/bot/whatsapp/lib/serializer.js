const {proto: proto, areJidsSameUser: areJidsSameUser} = require("baileys");

function serializeM(sock, m) {
  return smsg(sock, m);
}

function smsg(sock, m, hasParent) {
  if (!m) return m;
  const M = proto.WebMessageInfo;
  m = M.fromObject(m);
  if (m.key) {
    m.id = m.key.id;
    const isBotFn = global.settings.connection?.bot || (id => id.startsWith("BAE5") || id.indexOf("-") > 1);
    m.isBaileys = isBotFn(m.id);
    m.chat = sock.decodeJid(m.key.remoteJid || m.message?.senderKeyDistributionMessage?.groupId || "");
    m.isGroup = typeof m.chat === "string" && m.chat.endsWith("@g.us");
    m.sender = sock.decodeJid(m.key.fromMe && sock.user.id || m.participant || m.key.participant || m.chat || "");
    m.fromMe = m.key.fromMe || areJidsSameUser(m.sender, sock.user.id);
  }
  if (m.message) {
    const mtype = Object.keys(m.message);
    m.mtype = ![ "senderKeyDistributionMessage", "messageContextInfo" ].includes(mtype[0]) && mtype[0] || mtype.length >= 3 && mtype[1] !== "messageContextInfo" && mtype[1] || mtype[mtype.length - 1];
    m.msg = m.message[m.mtype];
    if (m.chat === "status@broadcast" && [ "protocolMessage", "senderKeyDistributionMessage" ].includes(m.mtype)) {
      m.chat = m.key.remoteJid !== "status@broadcast" && m.key.remoteJid || m.sender;
    }
    if (m.mtype === "protocolMessage" && m.msg.key) {
      if (m.msg.key.remoteJid === "status@broadcast") {
        m.msg.key.remoteJid = m.chat;
      }
      if (!m.msg.key.participant || m.msg.key.participant === "status_me") {
        m.msg.key.participant = m.sender;
      }
      m.msg.key.fromMe = sock.decodeJid(m.msg.key.participant) === sock.decodeJid(sock.user.id);
      if (!m.msg.key.fromMe && m.msg.key.remoteJid === sock.decodeJid(sock.user.id)) {
        m.msg.key.remoteJid = m.sender;
      }
    }
    m.text = m.msg.text || m.msg.caption || m.msg.contentText || m.msg || "";
    if (typeof m.text !== "string") {
      if ([ "protocolMessage", "messageContextInfo", "stickerMessage", "audioMessage", "senderKeyDistributionMessage" ].includes(m.mtype)) {
        m.text = "";
      } else {
        m.text = m.text.selectedDisplayText || m.text.hydratedTemplate?.hydratedContentText || m.text;
      }
    }
    m.mentionedJid = m.msg?.contextInfo?.mentionedJid?.length && m.msg.contextInfo.mentionedJid || [];
    let quoted = m.quoted = m.msg?.contextInfo?.quotedMessage ? m.msg.contextInfo.quotedMessage : null;
    if (m.quoted) {
      const type = Object.keys(m.quoted)[0];
      m.quoted = m.quoted[type];
      if (typeof m.quoted === "string") {
        m.quoted = {
          text: m.quoted
        };
      }
      m.quoted.mtype = type;
      m.quoted.id = m.msg.contextInfo.stanzaId;
      m.quoted.chat = sock.decodeJid(m.msg.contextInfo.remoteJid || m.chat || m.sender);
      const isBotFn = global.settings.connection?.bot || (id => id.startsWith("3EB0"));
      m.quoted.isBaileys = isBotFn(m.quoted.id);
      m.quoted.sender = sock.decodeJid(m.msg.contextInfo.participant) || m.chat;
      m.quoted.fromMe = m.quoted.sender === sock.user.id;
      m.quoted.text = m.quoted.text || m.quoted.caption || m.quoted.contentText || "";
      m.quoted.name = sock.getName(m.quoted.sender);
      m.quoted.mentionedJid = m.quoted.contextInfo?.mentionedJid?.length && m.quoted.contextInfo.mentionedJid || [];
      let vM = m.quoted.fakeObj = M.fromObject({
        key: {
          fromMe: m.quoted.fromMe,
          remoteJid: m.quoted.chat,
          id: m.quoted.id
        },
        message: quoted,
        ...m.isGroup ? {
          participant: m.quoted.sender
        } : {}
      });
      m.getQuotedObj = m.getQuotedMessage = async () => {
        if (!m.quoted.id) return null;
        let q = M.fromObject(await store.loadMessage(m.chat, m.quoted.id) || vM);
        return smsg(sock, q);
      };
      if (m.quoted.url || m.quoted.directPath) {
        m.quoted.download = (saveToFile = false) => sock.downloadM(m.quoted, m.quoted.mtype.replace(/message/i, ""), saveToFile);
      }
      m.quoted.reply = (text, chatId, options) => sock.reply(chatId ? chatId : m.chat, text, vM, options);
      m.quoted.copy = () => smsg(sock, M.fromObject(M.toObject(vM)));
      m.quoted.forward = (jid, forceForward = false) => sock.forwardMessage(jid, vM, forceForward);
      m.quoted.copyNForward = (jid, forceForward = true, options = {}) => sock.copyNForward(jid, vM, forceForward, options);
      m.quoted.cMod = (jid, text = "", sender = m.quoted.sender, options = {}) => sock.cMod(jid, vM, text, sender, options);
      m.quoted.delete = () => sock.sendMessage(m.quoted.chat, {
        delete: vM.key
      });
    }
  }
  m.name = m.pushName || sock.getName(m.sender);
  if (m.msg && m.msg.url) {
    m.download = (saveToFile = false) => sock.downloadM(m.msg, m.mtype.replace(/message/i, ""), saveToFile);
  }
  m.copy = () => smsg(sock, M.fromObject(M.toObject(m)));
  m.forward = (jid = m.chat, forceForward = false, options = {}) => sock.copyNForward(jid, m, forceForward, options);
  m.reply = async (pesan, options) => {
    try {
      if (options && pesan) {
        return sock.sendFile(m.chat, options, null, pesan, m, null);
      } else {
        if (pesan) {
          return sock.reply(m.chat, pesan, m);
        } else {
          return sock.reply(m.chat, options, m);
        }
      }
    } catch (e) {
      return sock.reply(m.chat, pesan, m);
    }
  };
  m.react = async emoji => await sock.sendMessage(m.chat, {
    react: {
      text: emoji,
      key: m.key
    }
  });
  m.copyNForward = (jid = m.chat, forceForward = true, options = {}) => sock.copyNForward(jid, m, forceForward, options);
  m.cMod = (jid, text = "", sender = m.sender, options = {}) => sock.cMod(jid, m, text, sender, options);
  m.delete = () => sock.sendMessage(m.chat, {
    delete: m.key
  });
  try {
    if (m.msg && m.mtype === "protocolMessage") {
      sock.ev.emit("message.delete", m.msg.key);
    }
  } catch (e) {
    console.error(e);
  }
  return m;
}

module.exports = {
  serializeM: serializeM,
  smsg: smsg
};