const __orig = {
  reg: true,
  help: "telegram",
  command: [ "telegram" ],
  tags: [ "owner" ],
  run: async (m, {sock: sock, usedPrefix: usedPrefix, args: args}) => {
    if (!args.length) {
      return m.reply(`*Telegram Bot Control*\n\n` + `Usage: ${usedPrefix}telegram <subcommand>\n\n` + `Commands:\n` + `${usedPrefix}telegram settoken <token>\n` + `${usedPrefix}telegram start\n` + `${usedPrefix}telegram stop\n` + `${usedPrefix}telegram restart\n` + `${usedPrefix}telegram status\n` + `${usedPrefix}telegram config`);
    }
    const command = args[0].toLowerCase();
    const telegramBot = global.telegramBot;
    if (!telegramBot) {
      return m.reply("Telegram bot module is not loaded.");
    }
    switch (command) {
     case "settoken":
      if (!args[1]) return m.reply("Please provide a token.");
      global.settings.telegram.token = args[1];
      global.settings.telegram.enabled = true;
      m.reply("Telegram token has been set.");
      break;

     case "start":
      if (telegramBot.isRunning) {
        return m.reply("Telegram bot is already running.");
      }
      const startResult = await telegramBot.initialize();
      m.reply(startResult ? "Telegram bot started." : "🚩 Failed to start Telegram bot.");
      break;

     case "stop":
      if (!telegramBot.isRunning) {
        return m.reply("Telegram bot is not running.");
      }
      await telegramBot.stop();
      m.reply("Telegram bot stopped.");
      break;

     case "restart":
      m.reply("🕒 Restarting Telegram bot...");
      await telegramBot.restart();
      m.reply("Telegram bot restarted.");
      break;

     case "status":
      const status = telegramBot.getStatus ? telegramBot.getStatus() : null;
      if (!status) return m.reply("Unable to get status.");
      const uptimeMs = status.uptime;
      const h = Math.floor(uptimeMs / 36e5);
      const min = Math.floor(uptimeMs % 36e5 / 6e4);
      const sec = Math.floor(uptimeMs % 6e4 / 1e3);
      m.reply(`*Telegram Bot Status*\n\n` + `Status: ${status.isRunning ? "Running" : "Offline"}\n` + `Token: ${status.token}\n` + `Plugins: ${status.plugins}\n` + `Uptime: ${h}h ${min}m ${sec}s`);
      break;

     case "config":
      m.reply(`*Telegram Configuration*\n\n` + `Token: ${global.settings.telegram.token ? "Set" : "Not Set"}\n` + `Enabled: ${global.settings.telegram.enabled ? "Yes" : "No"}\n` + `Prefix: ${global.settings.telegram.prefix}\n` + `Inline Mode: ${global.settings.telegram.inlineMode ? "Yes" : "No"}\n\n` + `*Group Manager:*\n` + `Welcome: ${global.settings.telegram.groupManager.welcomeMessage ? "On" : "Off"}\n` + `Goodbye: ${global.settings.telegram.groupManager.goodbyeMessage ? "On" : "Off"}\n` + `Auto Greeting: ${global.settings.telegram.groupManager.autoGreeting ? "On" : "Off"}\n` + `Verification: ${global.settings.telegram.groupManager.verification ? "On" : "Off"}\n` + `Moderation: ${global.settings.telegram.groupManager.moderation ? "On" : "Off"}`);
      break;

     default:
      m.reply("Unknown command. Use " + usedPrefix + "telegram for help.");
    }
  },
  example: "%cmd start\n%cmd settoken YOUR_TOKEN\n%cmd status"
};

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "telegram" ],
  category: "owner",
  help: "telegram",
  reg: true,
  example: "%cmd start\n%cmd settoken YOUR_TOKEN\n%cmd status",
  run: async function(c) {
    return __orig.run.call(__orig, c.m, c.props);
  }
});