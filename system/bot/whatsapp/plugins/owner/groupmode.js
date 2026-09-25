import sdkFacade from "../../../sdk/index.js";
let handler = async (m, { sock: sock, args: args, usedPrefix: usedPrefix }) => {
  const mode = args[0]?.toLowerCase();
  if (!mode || ![ "on", "off", "true", "false" ].includes(mode)) {
    return m.reply(`Current mode: *${global.settings.security.groupmode ? "ON" : "OFF"}*\n\nWhen ON, only premium users can use bot in DM.\n\nUsage: ${usedPrefix}groupmode on/off`);
  }
  global.settings.security.groupmode = [ "on", "true" ].includes(mode);
  m.reply(`Group mode has been *${global.settings.security.groupmode ? "enabled" : "disabled"}*`);
};

export default sdkFacade.define({
  name: [ "groupmode" ],
  category: "owner",
  help: [ "groupmode" ][0] || "",
  owner: true,
  reg: true,
  run: function(c) {
    return handler.apply(c.that, [ c.m, c.props ]);
  }
});