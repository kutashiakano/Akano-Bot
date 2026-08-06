let handler = async (m, { sock, args, usedPrefix }) => {
  const currentMode = global.settings.security.self ? "SELF" : "PUBLIC";

  if (args[0]) {
    const mode = args[0].toLowerCase();
    if (!["on", "off"].includes(mode)) {
      return m.reply(`Usage: ${usedPrefix}self on/off`);
    }
    global.settings.security.self = mode === "on";
    return m.reply(`Bot mode set to *${global.settings.security.self ? "SELF" : "PUBLIC"}*`);
  }

  const rows = [
    { title: "SELF Mode", description: "Only owner can use bot", id: `${usedPrefix}self on` },
    { title: "PUBLIC Mode", description: "Everyone can use bot", id: `${usedPrefix}self off` },
  ];

  await sock.sendIAMessage(
    m.chat,
    [],
    m,
    {
      header: "BOT MODE",
      content: `Current Mode: *${currentMode}*\n\n• SELF: Only owner can use bot\n• PUBLIC: Everyone can use bot`,
      footer: global.settings.footer,
    }
  );

  await sock.sendMessage(
    m.chat,
    {
      nativeFlow: [
        {
          name: "single_select",
          buttonParamsJson: JSON.stringify({
            title: "Select Mode",
            sections: [{ title: "Bot Mode", highlight_label: currentMode, rows }],
          }),
        },
      ],
    },
    { quoted: m }
  );
};
handler.help = ["self"];
handler.tags = ["owner"];
handler.command = ["self"];
handler.owner = true;
module.exports = handler;
