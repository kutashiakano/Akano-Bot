let handler = async (m, {sock: sock, args: args, usedPrefix: usedPrefix}) => {
  if (!m.isGroup) return m.reply(global.settings.message.group);
  const metadata = await sock.groupMetadata(m.chat);
  const participants = metadata.participants;
  const sender = m.key.participant || m.key.remoteJid;
  const isAdmin = participants.find(p => p.id === sender)?.admin;
  const isOwner = global.owner.includes(sender.split("@")[0]);
  if (!isAdmin && !isOwner) return m.reply(global.settings.message.admin);
  const botJid = sock.user.id.split(":")[0] + "@s.whatsapp.net";
  const isBotAdmin = participants.find(p => p.id === botJid)?.admin;
  if (!isBotAdmin) return m.reply(global.settings.message.botadmin);
  const chat = global.db.chats.get(m.chat);
  const currentStatus = chat.antilink ? "ON" : "OFF";
  if (args[0]) {
    const mode = args[0].toLowerCase();
    if (![ "on", "off" ].includes(mode)) {
      return m.reply(`Usage: ${usedPrefix}antilink on/off`);
    }
    const status = mode === "on";
    chat.antilink = status;
    global.db.chats.update(m.chat, chat);
    return m.reply(`Anti-link has been *${status ? "ENABLED" : "DISABLED"}*`);
  }
  const rows = [ {
    title: "ON",
    description: "Enable anti-link",
    id: `${usedPrefix}antilink on`
  }, {
    title: "OFF",
    description: "Disable anti-link",
    id: `${usedPrefix}antilink off`
  }, {
    title: "Status",
    description: `Current: ${currentStatus}`,
    id: `${usedPrefix}antilink`
  } ];
  await sock.sendMessage(m.chat, {
    location: {
      name: "ANTI-LINK",
      address: "Group Protection",
      jpegThumbnail: null
    },
    caption: `*ANTI-LINK SETTINGS*\n\nCurrent Status: *${currentStatus}*\n\nWhen enabled, any links shared in this group will be automatically deleted.`,
    footer: "Select an option below",
    mentions: [ m.sender ],
    nativeFlow: [ {
      name: "single_select",
      btnJson: JSON.stringify({
        title: "Select Action",
        sections: [ {
          title: "Anti-Link",
          highlight_label: "Protection",
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
  name: [ "antilink" ],
  category: "group",
  help: [ "antilink" ][0] || "",
  group: true,
  botAdmin: true,
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});