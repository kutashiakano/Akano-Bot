let handler = async (m, { sock, args, usedPrefix, command }) => {
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
handler.help = ["setwelcome", "setbye"];
handler.tags = ["group"];
handler.command = ["setwelcome", "setbye"];
handler.group = true;
handler.admin = true;
module.exports = handler;
