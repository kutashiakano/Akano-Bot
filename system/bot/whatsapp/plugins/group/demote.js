let handler = async (m, { sock, args, usedPrefix }) => {
  if (!m.isGroup) return m.reply(global.settings.message.group);
  const metadata = await sock.groupMetadata(m.chat);
  const participants = metadata.participants;
  const sender = m.key.participant || m.key.remoteJid;
  const isAdmin = participants.find((p) => p.id === sender)?.admin;
  const isOwner = global.owner.includes(sender.split("@")[0]);
  if (!isAdmin && !isOwner) return m.reply(global.settings.message.admin);

  let target =
    m.quoted?.sender ||
    m.mentions?.[0] ||
    (args[0] ? args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
  if (!target) return m.reply(`Usage: ${usedPrefix}demote @user or reply to user message`);

  const isAlready = participants.some((p) => p.id === target && !p.admin);
  if (isAlready) return m.reply("User is not an admin");

  try {
    await sock.groupParticipantsUpdate(m.chat, [target], "demote");
    m.reply(`@${target.split("@")[0]} has been demoted from admin`);
  } catch (e) {
    m.reply("🚩 Failed to demote user");
  }
};
const { define } = require("../../../plugin");

module.exports = define({
  name: ["demote"],
  category: (["group"])[0] || "tools",
  help: (["demote"])[0] || "",
  group: true,
  botAdmin: true,
  reg: true,
  run: function (c) { return handler.apply(c.that, [c.m, c.props]); },
});
