let handler = async (m, { sock, args, usedPrefix }) => {
  let target =
    m.quoted?.sender ||
    m.mentions?.[0] ||
    (args[0] ? args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);

  if (!target) {
    return sock.sendIAMessage(m.chat, [], m, {
      header: "UNBAN USER",
      content: "Reply to a user message or mention them to unban.",
      footer: global.settings.footer,
    });
  }

  const user = global.db.users.get(target);
  if (!user) return m.reply("User not found in database");

  const phone = target.split("@")[0];
  const status = user.banned ? "BANNED" : "NOT BANNED";

  if (args[1] === "confirm") {
    user.banned = false;
    user.ban_temporary = 0;
    global.db.users.update(target, user);
    return m.reply(`@${phone} has been *UNBANNED*`);
  }

  await sock.sendIAMessage(
    m.chat,
    [
      {
        name: "quick_reply",
        params: { display_text: "Confirm Unban", id: `${usedPrefix}unban ${phone} confirm` },
      },
      { name: "quick_reply", params: { display_text: "Cancel", id: `${usedPrefix}unban` } },
    ],
    m,
    {
      header: "CONFIRM UNBAN",
      content: `Target: @${phone}\nStatus: *${status}*\n\nBan times: ${user.ban_times || 0}\n\nAre you sure you want to unban this user?`,
      footer: global.settings.footer,
    },
  );
};
const { define } = require("../../../plugin");

module.exports = define({
  name: ["unban"],
  category: (["owner"])[0] || "tools",
  help: (["unban"])[0] || "",
  owner: true,
  reg: true,
  run: function (c) { return handler.apply(c.that, [c.m, c.props]); },
});
