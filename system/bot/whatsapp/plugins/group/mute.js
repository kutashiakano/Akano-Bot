let handler = async (m, { sock, args, usedPrefix }) => {
  if (!m.isGroup) return m.reply(global.settings.message.group);
  const metadata = await sock.groupMetadata(m.chat);
  const participants = metadata.participants;
  const sender = m.key.participant || m.key.remoteJid;
  const isAdmin = participants.find((p) => p.id === sender)?.admin;
  const isOwner = global.owner.includes(sender.split("@")[0]);
  if (!isAdmin && !isOwner) return m.reply(global.settings.message.admin);

  const chat = global.db.chats.get(m.chat);
  const currentStatus = chat.mute ? "MUTED" : "ACTIVE";

  if (args[0]) {
    const mode = args[0].toLowerCase();
    if (!["on", "off"].includes(mode)) {
      return m.reply(`Usage: ${usedPrefix}mute on/off`);
    }
    const status = mode === "on";
    chat.mute = status;
    global.db.chats.update(m.chat, chat);
    return m.reply(`Bot has been *${status ? "MUTED" : "UNMUTED"}* in this group`);
  }

  const rows = [
    {
      title: "MUTE",
      description: "Bot stops responding in this group",
      id: `${usedPrefix}mute on`,
    },
    { title: "UNMUTE", description: "Bot resumes responding", id: `${usedPrefix}mute off` },
    { title: "Status", description: `Current: ${currentStatus}`, id: `${usedPrefix}mute` },
  ];

  await sock.sendMessage(
    m.chat,
    {
      location: { name: "MUTE", address: "Group Settings", jpegThumbnail: null },
      caption: `*MUTE SETTINGS*\n\nCurrent Status: *${currentStatus}*\n\nWhen muted, the bot will not respond to commands in this group.`,
      footer: global.settings.footer,
      nativeFlow: [
        {
          name: "single_select",
          btnJson: JSON.stringify({
            title: "Select Action",
            sections: [{ title: "Mute", highlight_label: currentStatus, rows }],
          }),
        },
      ],
    },
    { quoted: m },
  );
};
const { define } = require("../../../plugin");

module.exports = define({
  name: ["mute"],
  category: (["group"])[0] || "tools",
  help: (["mute"])[0] || "",
  group: true,
  reg: true,
  run: function (c) { return handler.apply(c.that, [c.m, c.props]); },
});
