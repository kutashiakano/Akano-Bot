const { downloadContentFromMessage } = require("baileys");

module.exports = {
  help: "rvo",
  command: "rvo",
  tags: "tools",
  run: async (m, { sock, usedPrefix, command }) => {
    if (!m.quoted || !m.quoted.message) {
      return m.reply("Reply to a one-time view message.");
    }

    const msg = m.quoted.message;
    const type = Object.keys(msg)[0];
    const mediaTypes = {
      imageMessage: "image",
      videoMessage: "video",
      audioMessage: "audio",
    };

    if (!mediaTypes[type]) {
      return m.reply("Unsupported media type.");
    }

    try {
      const media = await downloadContentFromMessage(msg[type], mediaTypes[type]);
      let buffer = Buffer.from([]);

      for await (const chunk of media) {
        buffer = Buffer.concat([buffer, chunk]);
      }

      const messageOptions = {
        caption: msg[type]?.caption || "",
        viewOnce: command === "torvo",
      };

      switch (type) {
        case "videoMessage":
          await sock.sendMessage(
            m.chat, 
            { video: buffer, ...messageOptions }, 
            { quoted: m }
          );
          break;
        case "imageMessage":
          await sock.sendMessage(
            m.chat, 
            { image: buffer, ...messageOptions }, 
            { quoted: m }
          );
          break;
        case "audioMessage":
          await sock.sendMessage(
            m.chat, 
            { 
              audio: buffer, 
              mimetype: "audio/mpeg", 
              ptt: true, 
              ...messageOptions 
            }, 
            { quoted: m }
          );
          break;
      }
    } catch {
      m.reply("Failed to download media. Make sure you reply to a valid one-time view message.");
    }
  },
};