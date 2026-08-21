let handler = async (m, { sock, args, usedPrefix }) => {
  const currentPrefix = global.prefix.join(", ") || "no prefix";

  if (args[0]) {
    const newPrefix = args[0];
    if (newPrefix === "none") {
      global.prefix = ["", " "];
    } else {
      global.prefix = [newPrefix];
    }
    return m.reply(`Prefix has been changed to: *${global.prefix.join(", ") || "no prefix"}*`);
  }

  const rows = [
    { title: ". (dot)", description: "Use dot prefix", id: `${usedPrefix}prefix .` },
    { title: "# (hash)", description: "Use hash prefix", id: `${usedPrefix}prefix #` },
    {
      title: "! (exclamation)",
      description: "Use exclamation prefix",
      id: `${usedPrefix}prefix !`,
    },
    { title: "/ (slash)", description: "Use slash prefix", id: `${usedPrefix}prefix /` },
    { title: "None", description: "No prefix", id: `${usedPrefix}prefix none` },
  ];

  await sock.sendMessage(
    m.chat,
    {
      location: { name: "PREFIX SETTINGS", address: "Bot Configuration", jpegThumbnail: null },
      caption: `*PREFIX SETTINGS*\n\nCurrent Prefix: *${currentPrefix}*\n\nSelect a new prefix from the list below.`,
      footer: global.settings.footer,
      nativeFlow: [
        {
          name: "single_select",
          btnJson: JSON.stringify({
            title: "Select Prefix",
            sections: [{ title: "Prefix", highlight_label: currentPrefix, rows }],
          }),
        },
      ],
    },
    { quoted: m },
  );
};
const { define } = require("../../../plugin");

module.exports = define({
  name: ["prefix"],
  category: (["owner"])[0] || "tools",
  help: (["prefix"])[0] || "",
  owner: true,
  reg: true,
  run: function (c) { return handler.apply(c.that, [c.m, c.props]); },
});
