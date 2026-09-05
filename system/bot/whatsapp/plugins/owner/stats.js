let handler = async (m, {sock: sock}) => {
  const totalUsers = global.db.users.length;
  const totalGroups = global.db.groups.length;
  const totalChats = global.db.chats.length;
  const bannedUsers = global.db.users.filter(u => u.banned).length;
  const premiumUsers = global.db.users.filter(u => u.premium).length;
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor(uptime % 3600 / 60);
  const seconds = Math.floor(uptime % 60);
  const memUsage = process.memoryUsage();
  const memUsed = Math.round(memUsage.rss / 1024 / 1024);
  let caption = `*BOT STATISTICS*\n\n`;
  caption += `Uptime: ${hours}h ${minutes}m ${seconds}s\n`;
  caption += `Memory: ${memUsed} MB\n`;
  caption += `Total Users: ${totalUsers}\n`;
  caption += `Total Groups: ${totalGroups}\n`;
  caption += `Total Chats: ${totalChats}\n`;
  caption += `Premium: ${premiumUsers}\n`;
  caption += `Banned: ${bannedUsers}\n`;
  caption += `Plugins: ${Object.keys(global.plugin || {}).length}\n`;
  const buttons = [ {
    command: ".broadcast Refreshing bot...",
    text: "BC Test"
  }, {
    command: ".plugin list",
    text: "Disabled Plugins"
  }, {
    command: ".self",
    text: "Bot Mode"
  } ];
  await sock.replyButton(m.chat, buttons, m, {
    text: caption,
    footer: global.settings.footer
  });
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "stats" ],
  category: "owner",
  help: [ "stats" ][0] || "",
  owner: true,
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});