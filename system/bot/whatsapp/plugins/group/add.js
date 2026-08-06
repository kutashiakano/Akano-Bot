let handler = async (m, { sock, args, usedPrefix }) => {
  if (!m.isGroup) return m.reply(global.settings.message.group);
  const metadata = await sock.groupMetadata(m.chat);
  const participants = metadata.participants;
  const sender = m.key.participant || m.key.remoteJid;
  const isAdmin = participants.find(p => p.id === sender)?.admin;
  const isOwner = global.owner.includes(sender.split("@")[0]);
  if (!isAdmin && !isOwner) return m.reply(global.settings.message.admin);
  
  let target = m.quoted?.sender || m.mentions?.[0] || (args[0] ? args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
  if (!target) return m.reply(`Usage: ${usedPrefix}add @user or reply to user message`);
  
  const isAlready = participants.some(p => p.id === target);
  if (isAlready) return m.reply("User is already in the group");
  
  try {
    await sock.groupParticipantsUpdate(m.chat, [target], "add");
    m.reply(`@${target.split("@")[0]} has been added to the group`);
  } catch (e) {
    m.reply("Failed to add user. They may have privacy settings that prevent being added.");
  }
};
handler.help = ["add"];
handler.tags = ["group"];
handler.command = ["add"];
handler.group = true;
handler.botAdmin = true;
module.exports = handler;
