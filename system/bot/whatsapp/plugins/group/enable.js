let handler = async (m, {sock: sock, args: args, usedPrefix: usedPrefix, command: command, isOwner: _isOwner, isAdmin: _isAdmin}) => {
  if (!m.isGroup) return m.reply(global.settings.message.group);
  const isOwner = _isOwner || global.owner.includes(m.sender.split("@")[0]) || m.fromMe;
  const isAdmin = _isAdmin;
  if (!isAdmin && !isOwner) return m.reply(global.settings.message.admin);
  if (!global.db.data.chats[m.chat]) {
    global.db.data.chats[m.chat] = {
      welcome: true,
      left: true,
      detect: false,
      mute: false,
      member: [],
      chat: 0,
      expired: 0
    };
  }
  const chat = global.db.data.chats[m.chat];
  const type = (args[0] || "").toLowerCase();
  const value = (args[1] || "").toLowerCase();
  if (!type) {
    const rows = [ {
      title: "Welcome",
      description: chat.welcome ? "ON" : "OFF",
      id: `${usedPrefix}enable welcome`
    }, {
      title: "Goodbye",
      description: chat.left ? "ON" : "OFF",
      id: `${usedPrefix}enable leave`
    }, {
      title: "Detect",
      description: chat.detect ? "ON" : "OFF",
      id: `${usedPrefix}enable detect`
    }, {
      title: "Verification",
      description: chat.verification === false ? "OFF" : "ON",
      id: `${usedPrefix}enable verification`
    }, {
      title: "Set Welcome",
      description: chat.sWelcome ? "Custom" : "Default",
      id: `${usedPrefix}enable setwelcome `
    }, {
      title: "Set Goodbye",
      description: chat.sBye ? "Custom" : "Default",
      id: `${usedPrefix}enable setleave `
    }, {
      title: "Set Promote",
      description: chat.sPromote ? "Custom" : "Default",
      id: `${usedPrefix}enable setpromote `
    }, {
      title: "Set Demote",
      description: chat.sDemote ? "Custom" : "Default",
      id: `${usedPrefix}enable setdemote `
    }, {
      title: "Set Verification Question",
      description: chat.verifQuestion ? "Custom" : "Default",
      id: `${usedPrefix}setverif`
    }, {
      title: "Reset All",
      description: "Reset to default",
      id: `${usedPrefix}enable reset`
    } ];
    await sock.sendIAMessage(m.chat, [ {
      name: "single_select",
      btnJson: JSON.stringify({
        title: "Select Setting",
        sections: [ {
          title: "Toggle",
          highlight_label: "Recommended",
          rows: rows.slice(0, 4)
        }, {
          title: "Custom Text",
          rows: rows.slice(4, 8)
        }, {
          title: "Utility",
          rows: rows.slice(8)
        } ]
      })
    } ], m, {
      header: "GROUP SETTINGS",
      content: [ `Welcome: *${chat.welcome ? "ON" : "OFF"}*`, `Goodbye: *${chat.left ? "ON" : "OFF"}*`, `Detect: *${chat.detect ? "ON" : "OFF"}*`, `Verification: *${chat.verification === false ? "OFF" : "ON"}*`, "", `Custom welcome: *${chat.sWelcome ? "Set" : "Default"}*`, `Custom goodbye: *${chat.sBye ? "Set" : "Default"}*`, `Custom promote: *${chat.sPromote ? "Set" : "Default"}*`, `Custom demote: *${chat.sDemote ? "Set" : "Default"}*`, `Verification question: *${chat.verifQuestion ? "Set" : "Default (CAPTCHA)"}*` ].join("\n"),
      footer: "Akano Bot"
    });
    return;
  }
  const isEnable = /on|true|1/i.test(value);
  const isDisable = /off|false|0/i.test(value);
  switch (type) {
   case "welcome":
    if (!value) {
      chat.welcome = !chat.welcome;
      return m.reply(`Welcome message *${chat.welcome ? "ENABLED" : "DISABLED"}*`);
    }
    if (!isEnable && !isDisable) return m.reply(`Usage: ${usedPrefix}enable welcome on/off`);
    chat.welcome = isEnable;
    return m.reply(`Welcome message *${isEnable ? "ENABLED" : "DISABLED"}*`);

   case "leave":
   case "goodbye":
    if (!value) {
      chat.left = !chat.left;
      return m.reply(`Goodbye message *${chat.left ? "ENABLED" : "DISABLED"}*`);
    }
    if (!isEnable && !isDisable) return m.reply(`Usage: ${usedPrefix}enable leave on/off`);
    chat.left = isEnable;
    return m.reply(`Goodbye message *${isEnable ? "ENABLED" : "DISABLED"}*`);

   case "detect":
    if (!value) {
      chat.detect = !chat.detect;
      return m.reply(`Detect (promote/demote) *${chat.detect ? "ENABLED" : "DISABLED"}*`);
    }
    if (!isEnable && !isDisable) return m.reply(`Usage: ${usedPrefix}enable detect on/off`);
    chat.detect = isEnable;
    return m.reply(`Detect (promote/demote) *${isEnable ? "ENABLED" : "DISABLED"}*`);

   case "verification":
   case "verif":
    if (!value) {
      chat.verification = chat.verification === false;
      return m.reply(`Verification *${chat.verification === false ? "DISABLED" : "ENABLED"}*`);
    }
    if (!isEnable && !isDisable) return m.reply(`Usage: ${usedPrefix}enable verification on/off`);
    chat.verification = isEnable;
    return m.reply(`Verification *${isEnable ? "ENABLED" : "DISABLED"}*`);

   case "setwelcome":
    const welcomeText = args.slice(1).join(" ");
    if (!welcomeText) return m.reply(`Usage: ${usedPrefix}enable setwelcome Welcome @user to @subject!`);
    chat.sWelcome = welcomeText;
    return m.reply(`Custom welcome text *set*!`);

   case "setleave":
   case "setgoodbye":
    const leaveText = args.slice(1).join(" ");
    if (!leaveText) return m.reply(`Usage: ${usedPrefix}enable setleave Goodbye @user!`);
    chat.sBye = leaveText;
    return m.reply(`Custom goodbye text *set*!`);

   case "setpromote":
    const promoteText = args.slice(1).join(" ");
    if (!promoteText) return m.reply(`Usage: ${usedPrefix}enable setpromote @user is now an admin!`);
    chat.sPromote = promoteText;
    return m.reply(`Custom promote text *set*!`);

   case "setdemote":
    const demoteText = args.slice(1).join(" ");
    if (!demoteText) return m.reply(`Usage: ${usedPrefix}enable setdemote @user is no longer an admin.`);
    chat.sDemote = demoteText;
    return m.reply(`Custom demote text *set*!`);

   case "reset":
    delete chat.sWelcome;
    delete chat.sBye;
    delete chat.sPromote;
    delete chat.sDemote;
    return m.reply(`All custom text *reset to default*!`);

   default:
    return m.reply(`Unknown option: *${type}*\nType ${usedPrefix}enable to see available options.`);
  }
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "enable" ],
  category: "group",
  help: [ "enable" ][0] || "",
  group: true,
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});