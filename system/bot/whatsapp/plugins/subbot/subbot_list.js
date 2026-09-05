const ws = require("ws");
const moment = require("moment-timezone");

let handler = async (m, {sock: sock, usedPrefix: usedPrefix}) => {
  let list = "*List of Connected Bots*\n\n";
  let no = 1;
  if (!global.socks || !Array.isArray(global.socks)) {
    return m.reply("No bots connected.");
  }
  for (let i of global.socks) {
    if (!i.user) continue;
    let userInfo;
    try {
      userInfo = await i.fetchStatus(i.user.id);
    } catch {}
    let name = i.user.name || userInfo?.status?.name || "Unknown";
    let pushname = i.user.pushname || userInfo?.status?.pushname || name;
    let number = i.user.id.split("@")[0];
    let connectTime = i.connectTime ? moment(i.connectTime).format("HH:mm") : "-";
    let runtime = i.connectTime ? getRuntimeString(i.connectTime) : "-";
    list += `${no++}. ${pushname}\n`;
    list += `${global.settings.dot}  Number: wa.me/${number}\n`;
    list += `${global.settings.dot}  Connected: ${connectTime}\n`;
    list += `${global.settings.dot}  Runtime: ${runtime}\n`;
    list += `${global.settings.dot}  Auth Folder: ${i.authFolder || "-"}\n\n`;
    if (userInfo) {
      i.user.name = userInfo.status.name;
      i.user.pushname = userInfo.status.pushname;
    }
  }
  if (no === 1) return m.reply("No bots connected.");
  return sock.reply(m.chat, list, m);
};

function getRuntimeString(connectTime) {
  const now = new Date;
  const diff = now - new Date(connectTime);
  const hours = Math.floor(diff / (1e3 * 60 * 60));
  const minutes = Math.floor(diff % (1e3 * 60 * 60) / (1e3 * 60));
  if (hours > 0) {
    return `${hours} hours ${minutes} minutes`;
  } else {
    return `${minutes} minutes`;
  }
}

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "listbot" ],
  category: "subbot",
  help: [ "listbot" ][0] || "",
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});