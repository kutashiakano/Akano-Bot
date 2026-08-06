let handler = async (m, { sock, args, usedPrefix }) => {
  if (!args.length) return m.reply(`Usage: ${usedPrefix}broadcast [message]`);
  
  const text = args.join(" ");
  const groups = global.db.groups;
  if (!groups || groups.length === 0) return m.reply("No groups found");
  
  let success = 0;
  let failed = 0;
  
  m.reply(`Broadcasting to ${groups.length} groups...`);
  
  for (const group of groups) {
    try {
      await sock.sendMessage(group.jid, { text: text });
      success++;
    } catch {
      failed++;
    }
  }
  
  m.reply(`Broadcast complete!\nSuccess: ${success}\nFailed: ${failed}`);
};
handler.help = ["broadcast"];
handler.tags = ["owner"];
handler.command = ["broadcast"];
handler.owner = true;
module.exports = handler;
