let handler = async (m, { sock, args }) => {
  const user = global.db.users.get(m.sender);
  if (!user) return;

  user.afk = Date.now();
  user.afkReason = args.join(" ") || "No reason";
  user.afkObj = {
    sender: m.sender,
    chat: m.chat,
    time: Date.now(),
  };
  global.db.users.update(m.sender, user);

  await sock.sendMessageModify(
    m.chat,
    `@${m.sender.split("@")[0]} is now AFK\n\nReason: *${user.afkReason}*`,
    m,
    {
      title: "AFK MODE",
      body: "You will be notified when you're active again",
      largeThumb: false,
      thumbnail: global.settings.cover,
    }
  );
};
handler.help = ["afk"];
handler.tags = ["tools"];
handler.command = ["afk"];
module.exports = handler;
