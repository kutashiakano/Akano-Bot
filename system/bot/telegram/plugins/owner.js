const __orig = {
  help: "Control Telegram bot: start, stop, restart, status, config, settoken",
  command: ["telegram"],
  tags: ["owner"],
  owner: true,
  run: async (m, { sock, usedPrefix, args, text }) => {
    if (!args.length) {
      return m.reply(
        `*Telegram Bot Control*\n\n` +
          `Usage: ${usedPrefix}telegram <subcommand>\n\n` +
          `Available commands:\n` +
          `${usedPrefix}telegram settoken <token> - Set Telegram bot token\n` +
          `${usedPrefix}telegram start - Start Telegram bot\n` +
          `${usedPrefix}telegram stop - Stop Telegram bot\n` +
          `${usedPrefix}telegram restart - Restart Telegram bot\n` +
          `${usedPrefix}telegram status - Check Telegram bot status\n` +
          `${usedPrefix}telegram config - Show Telegram configuration`,
      );
    }

    const command = args[0].toLowerCase();
    const telegramBot = global.telegramBot;

    switch (command) {
      case "settoken":
        if (!args[1]) return m.reply("Please provide a token");
        global.settings.telegram.token = args[1];
        global.settings.telegram.enabled = true;
        m.reply("Telegram token has been set");
        break;

      case "start":
        if (telegramBot.isRunning) {
          return m.reply("Telegram bot is already running");
        }
        const startResult = await telegramBot.initialize();
        m.reply(startResult ? "Telegram bot started successfully" : "🚩 Failed to start Telegram bot");
        break;

      case "stop":
        if (!telegramBot.isRunning) {
          return m.reply("Telegram bot is not running");
        }
        await telegramBot.stop();
        m.reply("Telegram bot stopped");
        break;

      case "restart":
        m.reply("Restarting Telegram bot...");
        await telegramBot.restart();
        m.reply("Telegram bot restarted successfully");
        break;

      case "status":
        const status = telegramBot.getStatus();
        const uptimeMs = status.uptime;
        const uptimeHours = Math.floor(uptimeMs / 3600000);
        const uptimeMinutes = Math.floor((uptimeMs % 3600000) / 60000);
        const uptimeSeconds = Math.floor((uptimeMs % 60000) / 1000);

        const statusText =
          `*Telegram Bot Status*\n\n` +
          `Status: ${status.isRunning ? "Running" : "Offline"}\n` +
          `Token: ${status.token}\n` +
          `Plugins Loaded: ${status.plugins}\n` +
          `Uptime: ${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s`;
        m.reply(statusText);
        break;

      case "config":
        const configText =
          `*Telegram Configuration*\n\n` +
          `Token: ${global.settings.telegram.token ? "Set" : "Not Set"}\n` +
          `Enabled: ${global.settings.telegram.enabled ? "Yes" : "No"}\n` +
          `Prefix: ${global.settings.telegram.prefix}\n` +
          `Inline Mode: ${global.settings.telegram.inlineMode ? "Yes" : "No"}\n\n` +
          `*Group Manager Settings:*\n` +
          `Welcome Message: ${global.settings.telegram.groupManager.welcomeMessage ? "Yes" : "No"}\n` +
          `Goodbye Message: ${global.settings.telegram.groupManager.goodbyeMessage ? "Yes" : "No"}\n` +
          `Auto Greeting: ${global.settings.telegram.groupManager.autoGreeting ? "Yes" : "No"}\n` +
          `Verification: ${global.settings.telegram.groupManager.verification ? "Yes" : "No"}\n` +
          `Moderation: ${global.settings.telegram.groupManager.moderation ? "Yes" : "No"}`;
        m.reply(configText);
        break;

      default:
        m.reply("Unknown command. Use *" + usedPrefix + "telegram* for help");
    }
  },
  example: "%cmd start\n%cmd settoken YOUR_TOKEN\n%cmd status",
}
const { define } = require("../../plugin");

module.exports = define({
  name: ["telegram"],
  category: (["owner"])[0] || "general",
  help: "Control Telegram bot: start, stop, restart, status, config, settoken",
  owner: true,
  example: "%cmd start\n%cmd settoken YOUR_TOKEN\n%cmd status",
  run: async function (c) { return __orig.run(c.ctx, c.args); },
});
