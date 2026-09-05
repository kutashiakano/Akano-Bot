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
  const currentStatus = chat.antivirtex ? "ON" : "OFF";
  if (args[0]) {
    const mode = args[0].toLowerCase();
    if (![ "on", "off" ].includes(mode)) {
      return m.reply(`Usage: ${usedPrefix}antivirtex on/off`);
    }
    const status = mode === "on";
    chat.antivirtex = status;
    global.db.chats.update(m.chat, chat);
    return m.reply(`Anti-virtex has been *${status ? "ENABLED" : "DISABLED"}*`);
  }
  const rows = [ {
    title: "ON",
    description: "Enable anti-virtex",
    id: `${usedPrefix}antivirtex on`
  }, {
    title: "OFF",
    description: "Disable anti-virtex",
    id: `${usedPrefix}antivirtex off`
  }, {
    title: "Status",
    description: `Current: ${currentStatus}`,
    id: `${usedPrefix}antivirtex`
  } ];
  await sock.sendMessage(m.chat, {
    location: {
      name: "ANTI-VIRTEX",
      address: "Group Protection",
      jpegThumbnail: null
    },
    caption: `*ANTI-VIRTEX SETTINGS*\n\nCurrent Status: *${currentStatus}*\n\nWhen enabled, long text / virtex messages will be automatically deleted.`,
    footer: "Select an option below",
    mentions: [ m.sender ],
    nativeFlow: [ {
      name: "single_select",
      btnJson: JSON.stringify({
        title: "Select Action",
        sections: [ {
          title: "Anti-Virtex",
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
  name: [ "antivirtex" ],
  category: "group",
  help: [ "antivirtex" ][0] || "",
  group: true,
  botAdmin: true,
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});