let handler = async (m, { sock, command, usedPrefix, text }) => {
  if (/add(msg|vn|video|audio|img|sticker|gif)/i.test(command)) {
    if (!m.quoted) return m.reply("Reply to a message");
    if (!text)
      return m.reply(
        `Usage: ${usedPrefix + command} <teks>\nExample:\n${usedPrefix + command} tes`,
      );
    if (!global.db.data.msgs) global.db.data.msgs = {};
    if (text in global.db.data.msgs) return m.reply(`'${text}' is already registered!`);
    global.db.data.msgs[text] = { key: m.quoted.key, message: m.quoted.message };
    global.db.write?.();
    await sock.sendReact(m.chat, "", m.key);
  }

  if (/del(msg|vn|video|audio|img|sticker|gif)/i.test(command)) {
    if (!text) return m.reply(`Use *${usedPrefix}listmsg* to see the list`);
    if (!global.db.data.msgs || !(text in global.db.data.msgs))
      return m.reply(`Data \`${text}\` not found.`);
    delete global.db.data.msgs[text];
    global.db.write?.();
    await sock.sendReact(m.chat, "", m.key);
  }

  if (/get(msg|vn|video|audio|img|sticker|gif)/i.test(command)) {
    if (!text) return m.reply(`use *${usedPrefix}listmsg* to see the data list`);
    if (!global.db.data.msgs || !(text in global.db.data.msgs))
      return m.reply(`'${text}' not listed in the message list`);
    await sock
      .copyNForward(m.chat, JSON.parse(JSON.stringify(global.db.data.msgs[text])), true)
      .catch(() => m.reply("🚩 Failed to send stored message (media may be expired)"));
  }

  if (/list(msg|vn|video|audio|img|sticker|gif)/i.test(command)) {
    let msgs = global.db.data.msgs || {};
    let list =
      Object.keys(msgs)
        .map((v) => `- ${v}`)
        .join("\n") || "- (empty)";
    m.reply(`*List Message*\n${list}\n─────────────────────\n> Get : \`\`\`.getmsg [text]\`\`\``);
  }
};
const { define } = require("../../../plugin");

module.exports = define({
  name: /^(get|add|del|list)(vn|msg|video|audio|img|stic?ker|gif)$/,
  category: (["tools"])[0] || "tools",
  help: (["addmsg", "delmsg", "getmsg", "listmsg"].map((v) => v + " <teks>"))[0] || "",
  reg: true,
  run: function (c) { return handler.apply(c.that, [c.m, c.props]); },
});
