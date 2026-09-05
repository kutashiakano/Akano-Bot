let handler = async (m, {sock: sock, args: args, usedPrefix: usedPrefix}) => {
  let target = m.quoted?.sender || m.mentions?.[0] || (args[0] ? args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
  if (!target) return m.reply(`Usage: ${usedPrefix}block @user`);
  try {
    await sock.updateBlockStatus(target, "block");
    m.reply(`@${target.split("@")[0]} has been *blocked*`);
  } catch (e) {
    m.reply("🚩 Failed to block user");
  }
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "block" ],
  category: "owner",
  help: [ "block" ][0] || "",
  owner: true,
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});