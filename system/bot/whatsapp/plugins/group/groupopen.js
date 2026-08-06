let handler = async (m, { sock, args, usedPrefix, command }) => {
  let mode = {
    open: "not_announcement",
    close: "announcement",
  }[(args[0] || "").toLowerCase()];

  if (!mode) {
    return m.reply(`*Usage:*
- ${usedPrefix + command} close
- ${usedPrefix + command} open`);
  }

  await sock.groupSettingUpdate(m.chat, mode);
  m.reply(`Group has been *${args[0].toLowerCase()}d*`);
};
handler.help = ["group"];
handler.tags = ["group"];
handler.command = ["group"];
handler.group = true;
handler.admin = true;
handler.botAdmin = true;
module.exports = handler;
