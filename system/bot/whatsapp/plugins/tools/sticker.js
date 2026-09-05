const {sticker: sticker} = require("../../lib/converter");

let handler = async (m, {sock: sock, args: args, usedPrefix: usedPrefix}) => {
  const isQuoted = m.quoted && /image|video|webp/.test(m.quoted.mimetype);
  const isDirect = /image|video|webp/.test(m.mtype);
  if (!isQuoted && !isDirect) {
    return m.reply(`Reply or send image/video with caption ${usedPrefix}s`);
  }
  try {
    const msg = isQuoted ? m.quoted : m;
    const media = await msg.download();
    if (!media) return m.reply("🚩 Failed to download media");
    const packname = global.settings.media?.sticker?.packname;
    const author = global.settings.media?.sticker?.author;
    const result = await sticker(media, {
      packname: packname,
      author: author
    });
    if (!result) return m.reply("🚩 Failed to create sticker");
    await sock.sendMessage(m.chat, {
      sticker: result
    }, {
      quoted: m
    });
  } catch (e) {
    m.reply("🚩 Error creating sticker: " + e.message);
  }
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "sticker", "s" ],
  category: "tools",
  help: [ "sticker", "s" ][0] || "",
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});