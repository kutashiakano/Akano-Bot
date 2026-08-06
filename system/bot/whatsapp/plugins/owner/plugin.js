let handler = async (m, { sock, args, usedPrefix }) => {
  if (!args[0] || !["enable", "disable", "list"].includes(args[0].toLowerCase())) {
    return m.reply(`Usage:\n${usedPrefix}plugin disable [plugin name] - Disable plugin\n${usedPrefix}plugin enable [plugin name] - Enable plugin\n${usedPrefix}plugin list - List disabled plugins`);
  }
  
  const action = args[0].toLowerCase();
  const setting = global.db.setting;
  
  if (action === "list") {
    const disabled = setting.pluginDisable || [];
    if (disabled.length === 0) return m.reply("No plugins disabled");
    
    let caption = "*Disabled Plugins:*\n\n";
    for (const plugin of disabled) {
      caption += `- ${plugin}\n`;
    }
    return m.reply(caption);
  }
  
  const pluginName = args[1]?.replace(".js", "");
  if (!pluginName) return m.reply(`Usage: ${usedPrefix}plugin ${action} [plugin name]`);
  
  if (!setting.pluginDisable) setting.pluginDisable = [];
  
  if (action === "disable") {
    if (setting.pluginDisable.includes(pluginName)) {
      return m.reply("Plugin is already disabled");
    }
    setting.pluginDisable.push(pluginName);
    m.reply(`Plugin *${pluginName}* has been disabled`);
  } else if (action === "enable") {
    const index = setting.pluginDisable.indexOf(pluginName);
    if (index === -1) {
      return m.reply("Plugin is not disabled");
    }
    setting.pluginDisable.splice(index, 1);
    m.reply(`Plugin *${pluginName}* has been enabled`);
  }
};
handler.help = ["plugin"];
handler.tags = ["owner"];
handler.command = ["plugin"];
handler.owner = true;
module.exports = handler;
