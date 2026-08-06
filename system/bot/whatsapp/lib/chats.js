const { jidDecode, areJidsSameUser, generateWAMessage, proto } = require("baileys");
const PhoneNumber = require("awesome-phonenumber");

function extendChats(sock, store, ephemeral) {
  sock.decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      const decode = jidDecode(jid) || {};
      return (
        (decode.user && decode.server && decode.user + "@" + decode.server) ||
        jid
      );
    }
    return jid;
  };

  sock.chatRead = async (jid, participant = sock.user.id, messageID) => {
    return await sock.sendReadReceipt(jid, participant, [messageID]);
  };

  sock.getName = async (jid = "", withoutContact = false) => {
    jid = sock.decodeJid(jid);
    if (!jid || typeof jid !== "string") return "Unknown";
    if (jid.endsWith("@g.us")) {
      return new Promise(async (resolve) => {
        let v = (await sock.groupMetadata(jid)) || {};
        if (!(v.name || v.subject)) v = (await sock.groupMetadata(jid)) || {};
        resolve(
          v.name ||
            v.subject ||
            PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber(
              "international"
            )
        );
      });
    }

    let v =
      jid === "0@s.whatsapp.net"
        ? { jid, vname: "WhatsApp" }
        : areJidsSameUser(jid, sock.user.id)
        ? sock.user
        : {};

    return (
      (withoutContact ? "" : v.name) ||
      v.subject ||
      v.vname ||
      v.notify ||
      v.verifiedName ||
      PhoneNumber("+" + jid.replace("@s.whatsapp.net", "")).getNumber(
        "international"
      )
    );
  };

  sock.appendTextMessage = async (m, text, chatUpdate) => {
    let messages = await generateWAMessage(
      m.chat,
      {
        text: text,
        mentions: m.mentionedJid,
      },
      {
        userJid: sock.user.id,
        quoted: m.quoted && m.quoted.fakeObj,
        ...ephemeral,
      }
    );
    messages.key.fromMe = areJidsSameUser(m.sender, sock.user.id);
    messages.key.id = m.key.id;
    messages.pushName = m.pushName;
    if (m.isGroup) messages.participant = m.sender;
    let msg = {
      ...chatUpdate,
      messages: [proto.WebMessageInfo.fromObject(messages)],
      type: "append",
    };
    sock.ev.emit("messages.upsert", msg);
    return m;
  };
}

module.exports = { extendChats };
