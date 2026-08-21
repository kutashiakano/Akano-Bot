let handler = async (m, { sock, args, usedPrefix }) => {
  let target =
    m.quoted?.sender ||
    m.mentions?.[0] ||
    (args[0] ? args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);

  if (!target) {
    const rows = [
      { title: "Ban User", description: "Reply to or mention a user", id: `${usedPrefix}ban` },
    ];
    return sock.sendIAMessage(m.chat, [], m, {
      header: "BAN USER",
      content: "Reply to a user message or mention them to ban.",
      footer: global.settings.footer,
    });
  }

  const user = global.db.users.get(target);
  if (!user) return m.reply("User not found in database");

  const phone = target.split("@")[0];
  const status = user.banned ? "ALREADY BANNED" : "NOT BANNED";

  await sock.sendIAMessage(
    m.chat,
    [
      {
        name: "quick_reply",
        params: { display_text: "Confirm Ban", id: `${usedPrefix}ban ${phone} confirm` },
      },
      { name: "quick_reply", params: { display_text: "Cancel", id: `${usedPrefix}ban` } },
    ],
    m,
    {
      header: "CONFIRM BAN",
      content: `Target: @${phone}\nStatus: *${status}*\n\nBan times: ${user.ban_times || 0}\n\nAre you sure you want to ban this user?`,
      footer: global.settings.footer,
    },
  );

  if (args[1] === "confirm") {
    user.banned = true;
    user.ban_times = (user.ban_times || 0) + 1;
    global.db.users.update(target, user);
    return m.reply(`@${phone} has been *BANNED*`);
  }
};
const { define } = require("../../../plugin");

module.exports = define({
  name: ["ban"],
  category: (["owner"])[0] || "tools",
  help: (["ban"])[0] || "",
  owner: true,
  reg: true,
  run: function (c) { return handler.apply(c.that, [c.m, c.props]); },
});
