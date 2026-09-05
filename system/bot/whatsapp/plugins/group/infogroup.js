let handler = async (m, {sock: sock, participants: participants, groupMetadata: groupMetadata}) => {
  const pp = await sock.profilePictureUrl(m.chat, "image").catch(() => null) || "https://files.catbox.moe/ifx2y7.png";
  const chat = global.db.data.chats[m.chat] || {};
  const groupAdmins = (participants || []).filter(p => p.admin);
  const listAdmin = groupAdmins.map((v, i) => `${i + 1}. @${v.id.split("@")[0]}`).join("\n") || "No admins";
  const owner = groupMetadata.owner || groupAdmins.find(p => p.admin === "superadmin")?.id || m.chat.split("-")[0] + "@s.whatsapp.net";
  let text = `*「 Group Information 」*\n\n`;
  text += `*ID:*\n${groupMetadata.id}\n\n`;
  text += `*Name:*\n${groupMetadata.subject}\n\n`;
  text += `*Description:*\n${groupMetadata.desc?.toString() || "unknown"}\n\n`;
  text += `*Total Members:*\n${(participants || []).length} Members\n\n`;
  text += `*Group Owner:*\n@${owner.split("@")[0]}\n\n`;
  text += `*Group Admins:*\n${listAdmin}\n\n`;
  text += `*Group Settings:*\n`;
  text += `${chat.isBanned ? "" : ""} Banned\n`;
  text += `${chat.welcome ? "" : ""} Welcome\n`;
  text += `${chat.detect ? "" : ""} Detect\n`;
  text += `${chat.antiDelete?.length ? "" : ""} Anti Delete\n`;
  text += `${chat.antilink ? "" : ""} Anti Link\n`;
  const mentions = [ ...groupAdmins.map(v => v.id), owner ];
  await sock.sendFile(m.chat, pp, "pp.jpg", text, m, false, {
    mentions: mentions
  });
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "infogroup", "infogc", "groupinfo" ],
  category: "group",
  help: [ "infogroup" ][0] || "",
  group: true,
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});