let handler = async (m, {sock: sock, args: args}) => {
  if (!m.isGroup) return m.reply(global.settings.message.group);
  const metadata = await sock.groupMetadata(m.chat);
  const participants = metadata.participants;
  const sender = m.key.participant || m.key.remoteJid;
  const isAdmin = participants.find(p => p.id === sender)?.admin;
  const isOwner = global.owner.includes(sender.split("@")[0]);
  if (!isAdmin && !isOwner) return m.reply(global.settings.message.admin);
  const mentions = participants.map(p => p.id);
  const message = args.join(" ") || "Attention everyone!";
  await sock.sendMessage(m.chat, {
    text: message,
    mentions: mentions
  });
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "hidetag" ],
  category: "group",
  help: [ "hidetag" ][0] || "",
  group: true,
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});