let handler = async (m, {sock: sock, args: args, usedPrefix: usedPrefix}) => {
  if (!m.isGroup) return m.reply(global.settings.message.group);
  const metadata = await sock.groupMetadata(m.chat);
  const participants = metadata.participants;
  const sender = m.key.participant || m.key.remoteJid;
  const isAdmin = participants.find(p => p.id === sender)?.admin;
  const isOwner = global.owner.includes(sender.split("@")[0]);
  if (!isAdmin && !isOwner) return m.reply(global.settings.message.admin);
  const chat = global.db.chats.get(m.chat);
  const currentStatus = chat.left ? "ON" : "OFF";
  if (args[0]) {
    const mode = args[0].toLowerCase();
    if (![ "on", "off" ].includes(mode)) {
      return m.reply(`Usage: ${usedPrefix}left on/off`);
    }
    const status = mode === "on";
    chat.left = status;
    global.db.chats.update(m.chat, chat);
    return m.reply(`Goodbye message has been *${status ? "ENABLED" : "DISABLED"}*`);
  }
  const rows = [ {
    title: "ON",
    description: "Enable goodbye message",
    id: `${usedPrefix}left on`
  }, {
    title: "OFF",
    description: "Disable goodbye message",
    id: `${usedPrefix}left off`
  }, {
    title: "Status",
    description: `Current: ${currentStatus}`,
    id: `${usedPrefix}left`
  } ];
  await sock.sendMessage(m.chat, {
    location: {
      name: "GOODBYE",
      address: "Group Settings",
      jpegThumbnail: null
    },
    caption: `*GOODBYE MESSAGE SETTINGS*\n\nCurrent Status: *${currentStatus}*\n\nWhen enabled, leaving members will receive a goodbye message.`,
    footer: "Select an option below",
    mentions: [ m.sender ],
    nativeFlow: [ {
      name: "single_select",
      btnJson: JSON.stringify({
        title: "Select Action",
        sections: [ {
          title: "Goodbye",
          highlight_label: "Group",
          rows: rows
        } ]
      })
    } ]
  }, {
    quoted: m
  });
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "left" ],
  category: "group",
  help: [ "left" ][0] || "",
  group: true,
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});