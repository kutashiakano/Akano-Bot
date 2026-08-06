const { Telegraf, session } = require("telegraf");
const path = require("path");
const fs = require("fs");
const logger = require("./logger");
const handler = require("./handler");
const groupManager = require("./group-manager");

global.telegramBot = null;
global.telegramPlugins = {};

class TelegramBot {
  constructor() {
    this.bot = null;
    this.isRunning = false;
    this.startTime = null;
  }

  async initialize() {
    const token = global.settings?.telegram?.token;

    if (!token || token.length < 20) {
      logger.warn("Telegram token not set. Skipping initialization.");
      return false;
    }

    try {
      this.bot = new Telegraf(token);
      this.bot.use(session());

      handler.setup(this.bot);

      this.bot.catch((err, ctx) => {
        logger.error(`Bot error (${ctx?.updateType})`, err);
      });

      this.loadPlugins();

      const commandsList = [];
      for (const [name, plugin] of Object.entries(global.telegramPlugins)) {
        if (!plugin.command) continue;
        if (plugin.options && Array.isArray(plugin.options) && plugin.options.length === 0) continue;
        const cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
        for (const cmd of cmds) {
          if (typeof cmd === 'string' && cmd.length > 0) {
            commandsList.push({ command: cmd, description: plugin.help || "No description" });
          }
        }
      }
      if (commandsList.length > 0) {
        await this.bot.telegram.setMyCommands(commandsList).catch(e => logger.error("Failed to set bot commands", e));
        logger.info(`Registered ${commandsList.length} slash commands`);
      }

      await this.bot.launch({ dropPendingUpdates: true });

      this.isRunning = true;
      this.startTime = Date.now();

      const botName = global.botname;
      logger.info(`${botName} started. Plugins: ${Object.keys(global.telegramPlugins).length}`);

      process.once("SIGINT", () => this.bot.stop("SIGINT"));
      process.once("SIGTERM", () => this.bot.stop("SIGTERM"));

      return true;
    } catch (error) {
      logger.error("Failed to start Telegram bot", error);
      this.isRunning = false;
      return false;
    }
  }

  loadPlugins() {
    const pluginDir = path.join(__dirname, "plugins");

    if (!fs.existsSync(pluginDir)) {
      fs.mkdirSync(pluginDir, { recursive: true });
      return;
    }

    const files = fs.readdirSync(pluginDir).filter((f) => f.endsWith(".js"));

    let disabled = [];
    try {
      const db = require("../../database").get();
      disabled = db.settings?.disabledPlugins?.telegram || [];
    } catch (e) {}

    for (const file of files) {
      try {
        const pluginPath = path.join(pluginDir, file);
        const name = file.replace(".js", "").toLowerCase();
        if (disabled.includes(name)) continue;
        delete require.cache[require.resolve(pluginPath)];
        const plugin = require(pluginPath);
        global.telegramPlugins[name] = plugin;
      } catch (error) {
        logger.error(`Failed to load plugin ${file}`, error);
      }
    }
  }

  async stop() {
    if (this.bot) {
      await this.bot.stop().catch(() => {});
      this.isRunning = false;
      this.bot = null;
      logger.info("Telegram bot stopped");
    }
  }

  async restart() {
    await this.stop();
    await this.initialize();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      uptime: this.isRunning ? Date.now() - this.startTime : 0,
      token: global.settings?.telegram?.token ? "Set" : "Not Set",
      plugins: Object.keys(global.telegramPlugins).length,
    };
  }
}

const instance = new TelegramBot();
global.telegramBot = instance;
module.exports = instance;
