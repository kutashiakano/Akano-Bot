let handler = async (m, {sock: sock, args: args, usedPrefix: usedPrefix}) => {
  let group = m.chat;
  if (/^[0-9]{5,16}-?[0-9]+@g\.us$/.test(args[0] || "")) group = args[0];
  if (!/^[0-9]{5,16}-?[0-9]+@g\.us$/.test(group)) return m.reply("Only works in groups");
  let metadata = await sock.groupMetadata(group);
  if (!metadata || !metadata.participants) return m.reply("🚩 Failed to fetch group metadata");
  let me = metadata.participants.find(u => sock.decodeJid(u.id) === sock.decodeJid(sock.user.id));
  if (!me) return m.reply("I'm not in that group");
  if (!me.admin) return m.reply(global.settings.message.botadmin);
  let code = await sock.groupInviteCode(group);
  m.reply("https://chat.whatsapp.com/" + code);
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "linkgroup", "linkgc" ],
  category: "group",
  help: [ "linkgroup" ][0] || "",
  group: true,
  botAdmin: true,
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});