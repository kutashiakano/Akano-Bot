let handler = async (m, { sock, args, usedPrefix }) => {
  const mode = args[0]?.toLowerCase();
  if (!mode || !["on", "off", "true", "false"].includes(mode)) {
    return m.reply(
      `Current mode: *${global.settings.security.groupmode ? "ON" : "OFF"}*\n\nWhen ON, only premium users can use bot in DM.\n\nUsage: ${usedPrefix}groupmode on/off`,
    );
  }

  global.settings.security.groupmode = ["on", "true"].includes(mode);
  m.reply(`Group mode has been *${global.settings.security.groupmode ? "enabled" : "disabled"}*`);
};
const { define } = require("../../../plugin");

module.exports = define({
  name: ["groupmode"],
  category: (["owner"])[0] || "tools",
  help: (["groupmode"])[0] || "",
  owner: true,
  reg: true,
  run: function (c) { return handler.apply(c.that, [c.m, c.props]); },
});
