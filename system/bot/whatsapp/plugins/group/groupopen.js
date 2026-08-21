let handler = async (m, { sock, args, usedPrefix, command }) => {
  let mode = {
    open: "not_announcement",
    close: "announcement",
  }[(args[0] || "").toLowerCase()];

  if (!mode) {
    return m.reply(`*Usage:*
- ${usedPrefix + command} close
- ${usedPrefix + command} open`);
  }

  await sock.groupSettingUpdate(m.chat, mode);
  m.reply(`Group has been *${args[0].toLowerCase()}d*`);
};
const { define } = require("../../../plugin");

module.exports = define({
  name: ["group"],
  category: (["group"])[0] || "tools",
  help: (["group"])[0] || "",
  group: true,
  admin: true,
  botAdmin: true,
  reg: true,
  run: function (c) { return handler.apply(c.that, [c.m, c.props]); },
});
