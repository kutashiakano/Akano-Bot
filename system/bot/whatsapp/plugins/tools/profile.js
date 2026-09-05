let handler = async (m, {sock: sock, args: args}) => {
  const target = m.quoted?.sender || m.mentions?.[0] || m.sender;
  const user = global.db.users.get(target);
  if (!user) return m.reply("User not found in database");
  const isOwnerUser = global.owner.includes(target.split("@")[0]);
  const isPrem = user.premium || isOwnerUser;
  const phone = target.split("@")[0];
  let caption = `*USER PROFILE*\n\n`;
  caption += `Name: ${user.name || "Unknown"}\n`;
  caption += `JID: ${phone}\n`;
  caption += `Status: ${isOwnerUser ? "Owner" : isPrem ? "Premium" : "Free"}\n`;
  caption += `Limit: ${user.limit === "PERMANENT" ? "∞" : user.limit}\n`;
  caption += `Hit: ${user.hit || 0}\n`;
  caption += `Banned: ${user.banned ? "Yes" : "No"}\n`;
  if (user.afk > -1) {
    const duration = Date.now() - user.afk;
    caption += `\nAFK: Yes (${formatDuration(duration)})\n`;
    caption += `Reason: ${user.afkReason || "-"}\n`;
  }
  caption += `\nLast Seen: ${user.lastseen ? new Date(user.lastseen).toLocaleString() : "Never"}`;
  const buttons = [ {
    command: `.ban @${phone}`,
    text: "Ban"
  }, {
    command: `.unban @${phone}`,
    text: "Unban"
  }, {
    command: `.premium add @${phone}`,
    text: "Add Premium"
  } ];
  await sock.replyButton(m.chat, buttons, m, {
    text: caption,
    footer: global.settings.footer
  });
};

function formatDuration(ms) {
  const s = Math.floor(ms / 1e3);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "profile" ],
  category: "tools",
  help: [ "profile" ][0] || "",
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});