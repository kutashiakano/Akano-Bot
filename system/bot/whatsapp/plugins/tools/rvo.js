import { whatsapp } from "@kutashiakanocanzy/sdk";
import { define } from "../../../sdk/index.js";

const { download, media } = whatsapp;

const __orig = {
  reg: true,
  help: "rvo",
  command: "rvo",
  tags: "tools",
  run: async (m, { sock: sock, usedPrefix: usedPrefix, command: command }) => {
    if (!m.quoted || !m.quoted.message) {
      return m.reply("Reply to a one-time view message.");
    }
    const msg = m.quoted.message;
    const type = Object.keys(msg)[0];
    const mediaTypes = {
      imageMessage: "image",
      videoMessage: "video",
      audioMessage: "audio"
    };
    if (!mediaTypes[type]) {
      return m.reply("Unsupported media type.");
    }
    try {
      const buffer = await download(msg[type], mediaTypes[type], sock, m.quoted);
      const messageOptions = {
        caption: msg[type]?.caption || "",
        viewOnce: command === "torvo"
      };
      switch (type) {
       case "videoMessage":
        await media(sock, m.chat, buffer, "video", m, messageOptions);
        break;

       case "imageMessage":
        await media(sock, m.chat, buffer, "image", m, messageOptions);
        break;

       case "audioMessage":
        await media(sock, m.chat, buffer, "audio", m, messageOptions);
        break;
      }
    } catch {
      m.reply("🚩 Failed to download media. Make sure you reply to a valid one-time view message.");
    }
  }
};

export default define({
  name: "rvo",
  category: "tools",
  help: "rvo",
  reg: true,
  run: async function(c) {
    return __orig.run.call(__orig, c.m, c.props);
  }
});
