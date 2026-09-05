let handler = async (m, {sock: sock, args: args, usedPrefix: usedPrefix, command: command}) => {
  let mode = {
    open: "not_announcement",
    close: "announcement"
  }[(args[0] || "").toLowerCase()];
  if (!mode) {
    return m.reply(`*Usage:*\n- ${usedPrefix + command} close\n- ${usedPrefix + command} open`);
  }
  await sock.groupSettingUpdate(m.chat, mode);
  m.reply(`Group has been *${args[0].toLowerCase()}d*`);
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "group" ],
  category: "group",
  help: [ "group" ][0] || "",
  group: true,
  admin: true,
  botAdmin: true,
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});