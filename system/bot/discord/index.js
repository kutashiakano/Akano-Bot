const { Client, GatewayIntentBits } = require("discord.js");
const path = require("path");
const fs = require("fs");
const handler = require("./handler");

global.discordBot = null;
global.discordCommands = {};

class DiscordBot {
  constructor() {
    this.client = null;
    this.isRunning = false;
    this.startTime = null;
  }

  async initialize() {
    const token = global.settings?.discord?.token;

    if (!token || token.length < 20) {
      return false;
    }

    try {
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.GuildVoiceStates
        ]
      });

      this.loadCommands();
      handler.setup(this.client);

      await this.client.login(token);

      this.isRunning = true;
      this.startTime = Date.now();

      return true;
    } catch (error) {
      this.isRunning = false;
      return false;
    }
  }

  loadCommands() {
    const commandsDir = path.join(__dirname, "plugins");

    if (!fs.existsSync(commandsDir)) {
      fs.mkdirSync(commandsDir, { recursive: true });
      return;
    }

    const files = fs.readdirSync(commandsDir).filter((f) => f.endsWith(".js"));

    let disabled = [];
    try {
      const db = require("../../database").get();
      disabled = db.settings?.disabledPlugins?.discord || [];
    } catch (e) {}

    for (const file of files) {
      try {
        const commandPath = path.join(commandsDir, file);
        delete require.cache[require.resolve(commandPath)];
        const cmd = require(commandPath);
        if (cmd && cmd.name && cmd.execute && !disabled.includes(cmd.name)) {
          global.discordCommands[cmd.name] = cmd;
        }
      } catch (error) {
        console.error(error);
      }
    }
  }

  async stop() {
    if (this.client) {
      await this.client.destroy().catch(() => {});
      this.isRunning = false;
      this.client = null;
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
      token: global.settings?.discord?.token ? "Set" : "Not Set",
      commands: Object.keys(global.discordCommands).length,
    };
  }
}

const instance = new DiscordBot();
global.discordBot = instance;
module.exports = instance;
