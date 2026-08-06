let handler = async (m, { sock, args, usedPrefix }) => {
  const mode = args[0]?.toLowerCase();
  if (!mode || !["on", "off", "true", "false"].includes(mode)) {
    return m.reply(`Current mode: *${global.settings.security.groupmode ? "ON" : "OFF"}*\n\nWhen ON, only premium users can use bot in DM.\n\nUsage: ${usedPrefix}groupmode on/off`);
  }
  
  global.settings.security.groupmode = ["on", "true"].includes(mode);
  m.reply(`Group mode has been *${global.settings.security.groupmode ? "enabled" : "disabled"}*`);
};
handler.help = ["groupmode"];
handler.tags = ["owner"];
handler.command = ["groupmode"];
handler.owner = true;
module.exports = handler;
