let handler = async (m, { sock, args }) => {
  if (!m.isGroup) return m.reply(global.settings.message.group);
  const metadata = await sock.groupMetadata(m.chat);
  const participants = metadata.participants;
  const sender = m.key.participant || m.key.remoteJid;
  const isAdmin = participants.find(p => p.id === sender)?.admin;
  const isOwner = global.owner.includes(sender.split("@")[0]);
  if (!isAdmin && !isOwner) return m.reply(global.settings.message.admin);
  
  const mentions = participants.map(p => p.id);
  const message = args.join(" ") || "Attention everyone!";
  
  let caption = `*${message}*\n\n`;
  for (const participant of participants) {
    caption += `@${participant.id.split("@")[0]}\n`;
  }
  
  await sock.sendMessage(m.chat, { text: caption, mentions });
};
handler.help = ["tagall"];
handler.tags = ["group"];
handler.command = ["tagall"];
handler.group = true;
module.exports = handler;
