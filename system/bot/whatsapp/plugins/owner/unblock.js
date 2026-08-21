let handler = async (m, { sock, args, usedPrefix }) => {
  let target =
    m.quoted?.sender ||
    m.mentions?.[0] ||
    (args[0] ? args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
  if (!target) return m.reply(`Usage: ${usedPrefix}unblock @user`);

  try {
    await sock.updateBlockStatus(target, "unblock");
    m.reply(`@${target.split("@")[0]} has been *unblocked*`);
  } catch (e) {
    m.reply("🚩 Failed to unblock user");
  }
};
const { define } = require("../../../plugin");

module.exports = define({
  name: ["unblock"],
  category: (["owner"])[0] || "tools",
  help: (["unblock"])[0] || "",
  owner: true,
  reg: true,
  run: function (c) { return handler.apply(c.that, [c.m, c.props]); },
});
