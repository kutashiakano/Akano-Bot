let handler = async (m, {sock: sock, args: args, usedPrefix: usedPrefix}) => {
  if (!args.length) return m.reply(`Usage: ${usedPrefix}broadcast [message]`);
  const text = args.join(" ");
  const groups = global.db.groups;
  if (!groups || groups.length === 0) return m.reply("No groups found");
  let success = 0;
  let failed = 0;
  m.reply(`🕒 Broadcasting to ${groups.length} groups...`);
  for (const group of groups) {
    try {
      await sock.sendMessage(group.jid, {
        text: text
      });
      success++;
    } catch {
      failed++;
    }
  }
  m.reply(`Broadcast complete!\nSuccess: ${success}\nFailed: ${failed}`);
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "broadcast" ],
  category: "owner",
  help: [ "broadcast" ][0] || "",
  owner: true,
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});