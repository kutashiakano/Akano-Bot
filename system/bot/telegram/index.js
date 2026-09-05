const path = require("path");
const fs = require("fs");
const logger = require("./logger");
const handler = require("./handler");

global.telegramBot = null;

global.telegramPlugins = {};

let Bot, session;

let hydrateFiles = null;

try {
  ({Bot: Bot, session: session} = require("grammy"));
} catch (e) {
  Bot = null;
  session = null;
  logger.warn("grammy not installed, Telegram bot disabled");
}

try {
  ({hydrateFiles: hydrateFiles} = require("@grammyjs/files"));
} catch (e) {
  hydrateFiles = null;
  logger.warn("@grammyjs/files not installed, file download will use fallback URL");
}

const os = require("os");
const NodeCache = require("node-cache");

const TELEGRAM_LOCK_FILE = path.join(os.tmpdir(), "akano-telegram.lock");
const TELEGRAM_LOCK_TTL_MS = 60_000;

function isTelegramPollingDisabled() {
  const v = String(process.env.TELEGRAM_ENABLED || process.env.TELEGRAM_POLLING || "").toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "disabled") return true;
  const v2 = String(process.env.DISABLE_TELEGRAM || process.env.DISABLE_TG || "").toLowerCase();
  if (v2 === "1" || v2 === "true" || v2 === "yes") return true;
  if (global.settings?.telegram?.enabled === false) return true;
  return false;
}

function acquireTelegramLock() {
  try {
    if (fs.existsSync(TELEGRAM_LOCK_FILE)) {
      const st = fs.statSync(TELEGRAM_LOCK_FILE);
      const age = Date.now() - st.mtimeMs;
      if (age < TELEGRAM_LOCK_TTL_MS) {
        try {
          const content = fs.readFileSync(TELEGRAM_LOCK_FILE, "utf8").trim();
          const pid = parseInt(content.split(":")[0], 10);
          if (pid && pid !== process.pid) {
            try { process.kill(pid, 0); return false; } catch {}
          }
        } catch {}
        return false;
      }
    }
    fs.mkdirSync(path.dirname(TELEGRAM_LOCK_FILE), { recursive: true });
    fs.writeFileSync(TELEGRAM_LOCK_FILE, `${process.pid}:${Date.now()}`);
    return true;
  } catch { return true; }
}

function releaseTelegramLock() {
  try { if (fs.existsSync(TELEGRAM_LOCK_FILE)) {
    const c = fs.readFileSync(TELEGRAM_LOCK_FILE, "utf8").trim();
    if (c.startsWith(String(process.pid))) fs.unlinkSync(TELEGRAM_LOCK_FILE);
  }} catch {}
}

const avatarCache = new NodeCache({
  stdTTL: 600,
  checkperiod: 120
});

class TelegramBot {
  constructor(opts = {}) {
    this.bot = null;
    this.api = null;
    this.isRunning = false;
    this.startTime = null;
    this.tokenOverride = opts.token || opts.tokenOverride || null;
    this.id = opts.id || null;
    this.name = opts.name || null;
    this.avatarCache = avatarCache;
  }
  async getProfilePhotoUrl(userId) {
    if (!userId) return null;
    const cacheKey = `tg_avatar_${userId}`;
    const cached = avatarCache.get(cacheKey);
    if (cached) return cached;
    try {
      if (!this.bot || !this.api) return null;
      const photos = await this.api.getUserProfilePhotos(userId, {
        limit: 1
      });
      if (!photos || photos.total_count === 0 || !photos.photos?.[0]?.[0]) return null;
      const fileId = photos.photos[0][0].file_id;
      const file = await this.api.getFile(fileId);
      const token = this.tokenOverride || global.settings?.telegram?.token;
      if (!token || !file?.file_path) return null;
      const url = `https://api.telegram.org/file/bot${token}/${file.file_path}`;
      avatarCache.set(cacheKey, url);
      return url;
    } catch {
      return null;
    }
  }
  async initialize(tokenOverride) {
    if (isTelegramPollingDisabled()) {
      logger.warn("✗ Telegram disabled via env (TELEGRAM_ENABLED=false or DISABLE_TELEGRAM=1) — polling skipped. Run Telegram only on ONE instance to avoid 409 Conflict.");
      return false;
    }
    if (!acquireTelegramLock()) {
      logger.warn("✗ Telegram polling already active on this host (lock " + TELEGRAM_LOCK_FILE + ") — skipping start to avoid duplicate polling / 409 Conflict. Set TELEGRAM_ENABLED=false on secondary instances or enable webhook mode.");
      return false;
    }
    const token = tokenOverride || this.tokenOverride || global.settings?.telegram?.token;
    if (!token || token.length < 20) {
      releaseTelegramLock();
      logger.warn("✗ Telegram Not Connected (token empty)");
      return false;
    }
    if (!Bot) {
      releaseTelegramLock();
      logger.error("✗ Telegram Not Connected (grammy not installed)");
      return false;
    }
    try {
      this.bot = new Bot(token);
      this.api = this.bot.api;
      if (hydrateFiles) {
        try {
          this.bot.api.config.use(hydrateFiles(token));
        } catch (e) {
          logger.warn("hydrateFiles init failed, fallback to URL", e.message);
        }
      }
      this.bot.use(session({
        initial: () => ({})
      }));
      this.bot.use(async (ctx, next) => {
        ctx.user = ctx.from;
        ctx.username = ctx.from?.username || "Unknown";
        const msgId = ctx.msg?.message_id;
        if (msgId) {
          const wrap = orig => {
            if (typeof orig !== "function") return orig;
            return function(...args) {
              const other = args[1];
              if (!other || typeof other !== "object") {
                args[1] = {
                  reply_parameters: {
                    message_id: msgId
                  },
                  reply_to_message_id: msgId
                };
              } else {
                if (!other.reply_parameters && !other.reply_to_message_id) {
                  other.reply_parameters = {
                    message_id: msgId
                  };
                  other.reply_to_message_id = msgId;
                }
              }
              return orig.apply(this, args);
            };
          };
          if (ctx.reply) ctx.reply = wrap(ctx.reply.bind(ctx));
          if (ctx.replyWithPhoto) ctx.replyWithPhoto = wrap(ctx.replyWithPhoto.bind(ctx));
          if (ctx.replyWithAudio) ctx.replyWithAudio = wrap(ctx.replyWithAudio.bind(ctx));
          if (ctx.replyWithVideo) ctx.replyWithVideo = wrap(ctx.replyWithVideo.bind(ctx));
          if (ctx.replyWithDocument) ctx.replyWithDocument = wrap(ctx.replyWithDocument.bind(ctx));
          if (ctx.replyWithVoice) ctx.replyWithVoice = wrap(ctx.replyWithVoice.bind(ctx));
          if (ctx.replyWithAnimation) ctx.replyWithAnimation = wrap(ctx.replyWithAnimation.bind(ctx));
          if (ctx.replyWithSticker) ctx.replyWithSticker = wrap(ctx.replyWithSticker.bind(ctx));
          if (ctx.replyWithMediaGroup) ctx.replyWithMediaGroup = wrap(ctx.replyWithMediaGroup.bind(ctx));
          if (ctx.replyWithHTML) ctx.replyWithHTML = wrap(ctx.replyWithHTML.bind(ctx));
          if (ctx.replyWithMarkdown) ctx.replyWithMarkdown = wrap(ctx.replyWithMarkdown.bind(ctx));
        }
        return next();
      });
      handler.setup(this.bot);
      this.bot.catch(err => {
        const ctx = err.ctx;
        const msg = String(err.error?.message || err.message || err.error || err || "");
        if (/409|Conflict|terminated by other getUpdates|Conflict: terminated by other/.test(msg)) {
          logger.error("Telegram 409 Conflict: polling terminated by other getUpdates instance. Fix: run Telegram ONLY on one instance (set TELEGRAM_ENABLED=false on others or use webhook). Stopping duplicate poller.", err.error || err);
          try { this.bot.stop(); } catch {}
          this.isRunning = false;
          releaseTelegramLock();
          return;
        }
        logger.error(`Bot error (${ctx?.update?.message ? "message" : ctx?.updateType || "unknown"})`, err.error || err);
      });
      this.loadPlugins();
      const IMPORTANT_COMMANDS = [ "start", "menu", "dl", "gemini", "lyrics", "ping", "register" ];
      const commandsList = [];
      const seen = new Set;
      for (const [name, plugin] of Object.entries(global.telegramPlugins)) {
        if (!plugin.command) continue;
        const cmds = Array.isArray(plugin.command) ? plugin.command : [ plugin.command ];
        for (const cmd of cmds) {
          if (typeof cmd === "string" && cmd.length > 0 && IMPORTANT_COMMANDS.includes(cmd.toLowerCase()) && !seen.has(cmd.toLowerCase())) {
            seen.add(cmd.toLowerCase());
            commandsList.push({
              command: cmd.toLowerCase(),
              description: plugin.help || "No description"
            });
          }
        }
      }
      commandsList.sort((a, b) => IMPORTANT_COMMANDS.indexOf(a.command) - IMPORTANT_COMMANDS.indexOf(b.command));
      if (commandsList.length > 0) {
        const setC = () => this.bot.api.setMyCommands(commandsList);
        try {
          await setC();
        } catch (e) {
          try {
            await new Promise(r => setTimeout(r, 3e3));
            await setC();
          } catch (e2) {
            logger.warn("Failed to set slash commands");
          }
        }
      }
      await this.bot.api.deleteWebhook({
        drop_pending_updates: true
      }).catch(() => {});
      try {
        fs.writeFileSync(TELEGRAM_LOCK_FILE, `${process.pid}:${Date.now()}`);
      } catch {}
      const keepAlive = setInterval(() => {
        try { fs.writeFileSync(TELEGRAM_LOCK_FILE, `${process.pid}:${Date.now()}`); } catch {}
      }, 30_000);
      try { keepAlive.unref(); } catch {}
      this._lockTimer = keepAlive;
      this.bot.start({
        onStart: info => {
          logger.info(`✓ Telegram Connected @${info.username} (${Object.keys(global.telegramPlugins).length} plugins)`);
        }
      });
      this.isRunning = true;
      this.startTime = Date.now();
      process.once("SIGINT", () => this.stop());
      process.once("SIGTERM", () => this.stop());
      process.once("exit", releaseTelegramLock);
      return true;
    } catch (error) {
      const emsg = String(error?.message || error || "");
      if (/409|Conflict|terminated by other/.test(emsg)) {
        logger.error("Failed to start Telegram: 409 Conflict (another polling instance running). Run Telegram ONLY on one instance. Set TELEGRAM_ENABLED=false on secondary instances.", error);
      } else {
        logger.error("Failed to start Telegram bot", error);
      }
      this.isRunning = false;
      releaseTelegramLock();
      if (this._lockTimer) try { clearInterval(this._lockTimer); } catch {}
      return false;
    }
  }
  loadPlugins() {
    const pluginDir = path.join(__dirname, "plugins");
    if (!fs.existsSync(pluginDir)) {
      fs.mkdirSync(pluginDir, {
        recursive: true
      });
      return;
    }
    const collect = dir => {
      let result = [];
      for (const entry of fs.readdirSync(dir, {
        withFileTypes: true
      })) {
        if (entry.name.startsWith("_") || entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) result = result.concat(collect(full)); else if (entry.name.endsWith(".js")) result.push(full);
      }
      return result;
    };
    const files = collect(pluginDir);
    let disabled = [];
    try {
      const db = require("../../database").get();
      disabled = db.settings?.disabledPlugins?.telegram || [];
    } catch (e) {}
    for (const file of files) {
      try {
        const pluginPath = file;
        const name = path.basename(file, ".js").toLowerCase();
        if (disabled.includes(name)) continue;
        if (name === "_lib" || name === "helper") continue;
        delete require.cache[require.resolve(pluginPath)];
        const plugin = require(pluginPath);
        if (!plugin || typeof plugin !== "object" && typeof plugin !== "function") continue;
        if (!plugin.command && !plugin.run && !plugin.before && !plugin.onCallback) continue;
        global.telegramPlugins[name] = plugin;
      } catch (error) {
        logger.error(`Failed to load plugin ${file}`, error);
      }
    }
  }
  async stop() {
    if (this._lockTimer) try { clearInterval(this._lockTimer); this._lockTimer = null; } catch {}
    releaseTelegramLock();
    if (this.bot) {
      try {
        await this.bot.stop();
      } catch {}
      this.isRunning = false;
      this.bot = null;
      this.api = null;
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
      plugins: Object.keys(global.telegramPlugins).length
    };
  }
}

const instance = new TelegramBot;

global.telegramBot = instance;

instance.TelegramBot = TelegramBot;

instance.instance = instance;

async function getAvatarUrl(userId) {
  return instance.getProfilePhotoUrl(userId);
}

module.exports = instance;

module.exports.TelegramBot = TelegramBot;

module.exports.instance = instance;

module.exports.getAvatarUrl = getAvatarUrl;