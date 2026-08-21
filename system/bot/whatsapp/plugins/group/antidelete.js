let handler = async (m, { sock, args, usedPrefix }) => {
  if (!m.isGroup) return m.reply(global.settings.message.group);
  const metadata = await sock.groupMetadata(m.chat);
  const participants = metadata.participants;
  const sender = m.key.participant || m.key.remoteJid;
  const isAdmin = participants.find((p) => p.id === sender)?.admin;
  const isOwner = global.owner.includes(sender.split("@")[0]);
  if (!isAdmin && !isOwner) return m.reply(global.settings.message.admin);

  const chat = global.db.chats.get(m.chat);
  const currentStatus = chat.antidelete ? "ON" : "OFF";

  if (args[0]) {
    const mode = args[0].toLowerCase();
    if (!["on", "off"].includes(mode)) {
      return m.reply(`Usage: ${usedPrefix}antidelete on/off`);
    }
    const status = mode === "on";
    chat.antidelete = status;
    global.db.chats.update(m.chat, chat);
    return m.reply(`Anti-delete has been *${status ? "ENABLED" : "DISABLED"}*`);
  }

  const rows = [
    { title: "ON", description: "Enable anti-delete", id: `${usedPrefix}antidelete on` },
    { title: "OFF", description: "Disable anti-delete", id: `${usedPrefix}antidelete off` },
    { title: "Status", description: `Current: ${currentStatus}`, id: `${usedPrefix}antidelete` },
  ];

  await sock.sendMessage(
    m.chat,
    {
      location: { name: "ANTI-DELETE", address: "Group Protection", jpegThumbnail: null },
      caption: `*ANTI-DELETE SETTINGS*\n\nCurrent Status: *${currentStatus}*\n\nWhen enabled, deleted messages will be forwarded to this chat.`,
      footer: "Select an option below",
      mentions: [m.sender],
      nativeFlow: [
        {
          name: "single_select",
          btnJson: JSON.stringify({
            title: "Select Action",
            sections: [{ title: "Anti-Delete", highlight_label: "Protection", rows }],
          }),
        },
      ],
    },
    { quoted: m },
  );
};
const { define } = require("../../../plugin");

module.exports = define({
  name: ["antidelete"],
  category: (["group"])[0] || "tools",
  help: (["antidelete"])[0] || "",
  group: true,
  reg: true,
  run: function (c) { return handler.apply(c.that, [c.m, c.props]); },
});
