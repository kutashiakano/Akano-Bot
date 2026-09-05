let handler = async (m, {sock: sock, args: args, usedPrefix: usedPrefix}) => {
  const action = args[0]?.toLowerCase();
  if (!action || ![ "add", "remove", "list" ].includes(action)) {
    const rows = [ {
      title: "List Premium",
      description: "Show all premium users",
      id: `${usedPrefix}premium list`
    }, {
      title: "Add Premium",
      description: "Add user to premium",
      id: `${usedPrefix}premium add`
    }, {
      title: "Remove Premium",
      description: "Remove user from premium",
      id: `${usedPrefix}premium remove`
    } ];
    return sock.sendMessage(m.chat, {
      location: {
        name: "PREMIUM",
        address: "User Management",
        jpegThumbnail: null
      },
      caption: `*PREMIUM MANAGEMENT*\n\nSelect an action from the list below.`,
      footer: global.settings.footer,
      nativeFlow: [ {
        name: "single_select",
        btnJson: JSON.stringify({
          title: "Select Action",
          sections: [ {
            title: "Premium",
            highlight_label: "Management",
            rows: rows
          } ]
        })
      } ]
    }, {
      quoted: m
    });
  }
  if (action === "list") {
    const premiums = global.db.users.filter(u => u.premium);
    if (premiums.length === 0) return m.reply("No premium users found");
    let caption = "*Premium Users:*\n\n";
    for (const user of premiums) {
      caption += `• @${user.jid.split("@")[0]}\n`;
    }
    return m.reply(caption, null, {
      mentions: premiums.map(u => u.jid)
    });
  }
  let target = m.quoted?.sender || m.mentions?.[0] || (args[1] ? args[1].replace(/[^0-9]/g, "") + "@s.whatsapp.net" : null);
  if (!target) return m.reply(`Usage: ${usedPrefix}premium ${action} @user`);
  const user = global.db.users.get(target);
  if (!user) return m.reply("User not found in database");
  const phone = target.split("@")[0];
  if (action === "add") {
    user.premium = true;
    user.limit = "PERMANENT";
    global.db.users.update(target, user);
    return m.reply(`@${phone} has been added to *premium*`);
  } else if (action === "remove") {
    user.premium = false;
    user.limit = global.settings.limit?.freeUser || 15;
    global.db.users.update(target, user);
    return m.reply(`@${phone} has been removed from *premium*`);
  }
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "premium" ],
  category: "owner",
  help: [ "premium" ][0] || "",
  owner: true,
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});