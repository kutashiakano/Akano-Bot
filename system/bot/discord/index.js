import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import sdkFacade from "../sdk/index.js";
import handler from "./handler.js";

const { Client, GatewayIntentBits } = sdkFacade.engine();

global.discordBot = null;

global.discordCommands = {};

class DiscordBot {
  constructor(opts = {}) {
    this.client = null;
    this.isRunning = false;
    this.startTime = null;
    this.tokenOverride = opts.token || opts.tokenOverride || null;
    this.id = opts.id || null;
    this.name = opts.name || null;
  }
  async initialize(tokenOverride) {
    const token = tokenOverride || this.tokenOverride || global.settings?.discord?.token;
    if (!token || token.length < 20) {
      try {
        const chalk = (await import("chalk")).default;
        console.log(chalk.hex("#5865F2")("[DC] ✗ Not Connected (token empty)"));
      } catch {}
      return false;
    }
    try {
      this.client = new Client({
        intents: [ GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration ],
        messageCacheMaxSize: 25,
        messageCacheLifetime: 21600,
        messageSweepInterval: 43200,
        messageEditHistoryMaxSize: 0
      });
      try { Object.assign(this.client, sdkFacade.djs() || {}); } catch {}
      await this.loadCommands();
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
  async loadCommands() {
    const commandsDir = path.join(import.meta.dirname, "plugins");
    if (!fs.existsSync(commandsDir)) {
      fs.mkdirSync(commandsDir, {
        recursive: true
      });
      return;
    }
    const collect = dir => {
      let result = [];
      for (const entry of fs.readdirSync(dir, {
        withFileTypes: true
      })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) result = result.concat(collect(full)); else if (entry.name.endsWith(".js")) result.push(full);
      }
      return result;
    };
    const files = collect(commandsDir);
    let disabled = [];
    try {
      const { default: database } = await import("../../database/index.js");
      disabled = database.get().settings?.disabledPlugins?.discord || [];
    } catch (e) {}
    for (const file of files) {
      try {
        const mod = await import(pathToFileURL(file).href + "?t=" + Date.now());
        const cmd = mod.default || mod;
        if (cmd && cmd.name && cmd.execute && !disabled.includes(cmd.name)) {
          const rel = path.relative(commandsDir, file);
          cmd.category = (rel.split(path.sep)[0] || "tools").toLowerCase();
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
      commands: Object.keys(global.discordCommands).length
    };
  }
}

const instance = new DiscordBot;

global.discordBot = instance;

instance.DiscordBot = DiscordBot;

instance.instance = instance;

export default instance;
export { DiscordBot };
