let handler = async (m, { sock, args, usedPrefix }) => {
  let target =
    m.quoted?.sender ||
    m.mentions?.[0] ||
    (args[0] ? args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
  const limit = parseInt(args[1]);

  if (!target || isNaN(limit)) {
    return m.reply(`Usage: ${usedPrefix}setlimit @user [limit]`);
  }

  const user = global.db.users.get(target);
  if (!user) return m.reply("User not found in database");

  user.limit = limit;
  global.db.users.update(target, user);

  m.reply(`@${target.split("@")[0]} limit has been set to *${limit}*`);
};
const { define } = require("../../../plugin");

module.exports = define({
  name: ["setlimit"],
  category: (["owner"])[0] || "tools",
  help: (["setlimit"])[0] || "",
  owner: true,
  reg: true,
  run: function (c) { return handler.apply(c.that, [c.m, c.props]); },
});
