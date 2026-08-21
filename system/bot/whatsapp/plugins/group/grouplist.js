let handler = async (m, { sock }) => {
  let txt = "";
  let chats = global.store?.chats || {};
  for (let [jid, chat] of Object.entries(chats)) {
    if (!jid.endsWith("@g.us") || !chat.isChats) continue;
    let name = chat.name || jid;
    let status = chat?.metadata?.read_only ? "Left" : "Joined";
    txt += `*${name}*\n ${jid} [${status}]\n\n`;
  }
  if (!txt) return m.reply("No groups found in store");
  m.reply(`*List Groups:*\n\n${txt}`.trim());
};
const { define } = require("../../../plugin");

module.exports = define({
  name: ["grouplist", "groups"],
  category: (["group"])[0] || "tools",
  help: (["grouplist"])[0] || "",
  group: false,
  reg: true,
  run: function (c) { return handler.apply(c.that, [c.m, c.props]); },
});
