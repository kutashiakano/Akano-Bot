let handler = async (m, { sock }) => {
  if (!m.isGroup) return m.reply(global.settings.message.group);

  let key = {};
  try {
    key.remoteJid = m.quoted ? m.quoted.key.remoteJid : m.key.remoteJid;
    key.fromMe = m.quoted ? m.quoted.key.fromMe : m.key.fromMe;
    key.id = m.quoted ? m.quoted.key.id : m.key.id;
    key.participant = m.quoted ? m.quoted.key.participant : m.key.participant;
  } catch (e) {}

  if (m.quoted && !m.quoted.key.fromMe) {
    const metadata = await sock.groupMetadata(m.chat);
    const sender = metadata.participants.find((p) => sock.decodeJid(p.id) === m.sender);
    const isAdmin = sender?.admin || false;
    const isOwner = global.owner.includes(m.sender.split("@")[0]) || m.fromMe;
    if (!isAdmin && !isOwner) return m.reply(global.settings.message.admin);
  }

  await sock.sendMessage(m.chat, { delete: key });
};
const { define } = require("../../../plugin");

module.exports = define({
  name: ["delete", "del"],
  category: (["tools"])[0] || "tools",
  help: (["delete"])[0] || "",
  group: true,
  reg: true,
  run: function (c) { return handler.apply(c.that, [c.m, c.props]); },
});
