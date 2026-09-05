let handler = async (m, {sock: sock, args: args, usedPrefix: usedPrefix, command: command}) => {
  if (!m.isGroup) return m.reply(global.settings.message.group);
  if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = {};
  let chat = global.db.data.chats[m.chat];
  let text = args.join(" ").trim();
  if (!text) {
    return m.reply(`> Usage: ${usedPrefix + command} <text & options>\n> *Options:*\n  - @user\n  - @subject\n  - @desc\n\n> *Example:*\n  Welcome to @subject, @user!`);
  }
  if (/setwelcome/i.test(command)) {
    chat.sWelcome = text;
    global.db.write?.();
    return m.reply("Welcome message updated");
  }
  if (/setbye/i.test(command)) {
    chat.sBye = text;
    global.db.write?.();
    return m.reply("Goodbye message updated");
  }
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "setwelcome", "setbye" ],
  category: "group",
  help: [ "setwelcome", "setbye" ][0] || "",
  group: true,
  admin: true,
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});