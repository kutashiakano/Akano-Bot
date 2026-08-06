let handler = async (m, { sock, args, usedPrefix }) => {
  let target = m.quoted?.sender || m.mentions?.[0] || (args[0] ? args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
  
  if (!target) {
    return m.reply(`Usage: ${usedPrefix}resetlimit @user`);
  }
  
  const user = global.db.users.get(target);
  if (!user) return m.reply("User not found in database");
  
  user.limit = user.premium ? "PERMANENT" : (global.settings.limit?.freeUser || 15);
  global.db.users.update(target, user);
  
  m.reply(`@${target.split("@")[0]} limit has been reset to *${user.limit}*`);
};
handler.help = ["resetlimit"];
handler.tags = ["owner"];
handler.command = ["resetlimit"];
handler.owner = true;
module.exports = handler;
