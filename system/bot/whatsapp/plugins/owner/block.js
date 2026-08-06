let handler = async (m, { sock, args, usedPrefix }) => {
  let target = m.quoted?.sender || m.mentions?.[0] || (args[0] ? args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
  if (!target) return m.reply(`Usage: ${usedPrefix}block @user`);
  
  try {
    await sock.updateBlockStatus(target, "block");
    m.reply(`@${target.split("@")[0]} has been *blocked*`);
  } catch (e) {
    m.reply("Failed to block user");
  }
};
handler.help = ["block"];
handler.tags = ["owner"];
handler.command = ["block"];
handler.owner = true;
module.exports = handler;
