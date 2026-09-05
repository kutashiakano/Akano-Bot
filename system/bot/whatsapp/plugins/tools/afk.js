let handler = async (m, {sock: sock, args: args}) => {
  const user = global.db.users.get(m.sender);
  if (!user) return;
  user.afk = Date.now();
  user.afkReason = args.join(" ") || "No reason";
  user.afkObj = {
    sender: m.sender,
    chat: m.chat,
    time: Date.now()
  };
  global.db.users.update(m.sender, user);
  await sock.sendMessageModify(m.chat, `@${m.sender.split("@")[0]} is now AFK\n\nReason: *${user.afkReason}*`, m, {
    title: "AFK MODE",
    body: "You will be notified when you're active again",
    largeThumb: false,
    thumbnail: global.settings.cover
  });
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "afk" ],
  category: "tools",
  help: [ "afk" ][0] || "",
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});