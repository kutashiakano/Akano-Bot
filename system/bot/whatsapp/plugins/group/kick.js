let handler = async (m, { sock, args, usedPrefix }) => {
  if (!m.isGroup) return m.reply(global.settings.message.group);
  const metadata = await sock.groupMetadata(m.chat);
  const participants = metadata.participants;
  const sender = m.key.participant || m.key.remoteJid;
  const isAdmin = participants.find(p => p.id === sender)?.admin;
  const isOwner = global.owner.includes(sender.split("@")[0]);
  if (!isAdmin && !isOwner) return m.reply(global.settings.message.admin);
  
  let target = m.quoted?.sender || m.mentions?.[0] || (args[0] ? args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
  if (!target) return m.reply(`Usage: ${usedPrefix}kick @user or reply to user message`);
  
  if (target === sender) return m.reply("You cannot kick yourself");
  
  const isAlready = participants.some(p => p.id === target);
  if (!isAlready) return m.reply("User is not in the group");
  
  try {
    await sock.groupParticipantsUpdate(m.chat, [target], "remove");
    m.reply(`@${target.split("@")[0]} has been kicked from the group`);
  } catch (e) {
    m.reply("Failed to kick user");
  }
};
handler.help = ["kick"];
handler.tags = ["group"];
handler.command = ["kick"];
handler.group = true;
handler.botAdmin = true;
module.exports = handler;
