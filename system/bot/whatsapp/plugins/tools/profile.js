const fmt = require("../../../sdk/core");

let handler = async (m, { sock: sock, command: command }) => {
  const target = command === "me" ? m.sender : m.quoted?.sender || m.mentions?.[0] || m.sender;
  const user = global.db.users.get(target);
  if (!user) return m.reply(global.settings.message.userNotFoundDb);
  const isOwnerUser = global.owner.includes(target.split("@")[0]);
  const isPrem = user.premium || isOwnerUser;
  const phone = target.split("@")[0];
  const caption = fmt.userCard("wa", {
    name: user.name || m.pushName || "Unknown",
    id: phone,
    limit: user.limit === "PERMANENT" ? "∞" : fmt.formatNumber(user.limit),
    hit: fmt.formatNumber(user.hit || 0),
    warning: (user.warn || 0) + " / 3",
    blocked: false,
    banned: !!user.banned,
    usePrivate: !!global.db.chats?.[target],
    premium: isPrem,
    expired: isPrem ? "∞" : "-",
    lastseen: user.afk > -1 ? "AFK" + (user.afkReason ? " (" + user.afkReason + ")" : "") : user.lastseen ? new Date(user.lastseen).toLocaleString() : "Never",
    footer: global.settings.footer
  });
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

const { define: define } = require("../../../sdk");

module.exports = define({
  name: [ "profile", "me" ],
  category: "tools",
  help: [ "profile" ][0] || "",
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});
