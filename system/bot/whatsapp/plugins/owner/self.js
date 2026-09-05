let handler = async (m, {sock: sock, args: args, usedPrefix: usedPrefix}) => {
  const currentMode = global.settings.security.self ? "SELF" : "PUBLIC";
  if (args[0]) {
    const mode = args[0].toLowerCase();
    if (![ "on", "off" ].includes(mode)) {
      return m.reply(`Usage: ${usedPrefix}self on/off`);
    }
    global.settings.security.self = mode === "on";
    return m.reply(`Bot mode set to *${global.settings.security.self ? "SELF" : "PUBLIC"}*`);
  }
  const rows = [ {
    title: "SELF Mode",
    description: "Only owner can use bot",
    id: `${usedPrefix}self on`
  }, {
    title: "PUBLIC Mode",
    description: "Everyone can use bot",
    id: `${usedPrefix}self off`
  } ];
  await sock.sendIAMessage(m.chat, [], m, {
    header: "BOT MODE",
    content: `Current Mode: *${currentMode}*\n\n• SELF: Only owner can use bot\n• PUBLIC: Everyone can use bot`,
    footer: global.settings.footer
  });
  await sock.sendMessage(m.chat, {
    nativeFlow: [ {
      name: "single_select",
      btnJson: JSON.stringify({
        title: "Select Mode",
        sections: [ {
          title: "Bot Mode",
          highlight_label: currentMode,
          rows: rows
        } ]
      })
    } ]
  }, {
    quoted: m
  });
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "self" ],
  category: "owner",
  help: [ "self" ][0] || "",
  owner: true,
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});