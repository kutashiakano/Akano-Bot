let handler = async (m, { sock }) => {
  let txt = "";
  let chats = global.store?.chats || {};
  for (let [jid, chat] of Object.entries(chats)) {
    if (!jid.endsWith("@g.us") || !chat.isChats) continue;
    let name = chat.name || jid;
    let status = chat?.metadata?.read_only ? "Left" : "Joined";
    txt += `*${name}*\n🪪 ${jid} [${status}]\n\n`;
  }
  if (!txt) return m.reply("No groups found in store");
  m.reply(`*List Groups:*\n\n${txt}`.trim());
};
handler.help = ["grouplist"];
handler.tags = ["group"];
handler.command = ["grouplist", "groups"];
handler.group = false;
module.exports = handler;
