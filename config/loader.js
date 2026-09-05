const fs = require("fs");
const path = require("path");

class ConfigLoader {
  constructor(options = {}) {
    this.configDir = options.configDir || __dirname;
    this.primaryFile = options.primaryFile || path.join(this.configDir, "config.json");
    this.legacyFile = options.legacyFile || path.join(this.configDir, "settings.json");
    this.modularFiles = options.modularFiles || [
      "bot.json",
      "messages.json",
      "whatsapp.json",
      "system.json",
      "media.json",
      "telegram.json",
      "discord.json",
      "website.json",
    ];
  }

  static create(options) {
    return new ConfigLoader(options);
  }

  static load(options) {
    return new ConfigLoader(options).load();
  }

  static ENV_PATTERN = /\$\{(\w+)(?::-([^}]+))?\}/g;

  static interpolate(raw) {
    return raw.replace(ConfigLoader.ENV_PATTERN, (_, name, fallback) => {
      const v = process.env[name];
      if (v !== undefined && v !== "") return v;
      return fallback !== undefined ? fallback : "";
    });
  }

  static parseOwners() {
    const env = (name, fb) => process.env[name] || process.env[fb] || "";
    const split = (v) => String(v || "").split(",").map((s) => s.trim()).filter(Boolean);

    let owner = split(env("ID_OWNER", "OWNER_ID"));
    if (owner.length === 0) owner = split(env("OWNER", ""));
    let tgOwner = split(env("TELEGRAM_OWNER_ID", "TG_OWNER_ID"));
    if (tgOwner.length === 0) tgOwner = split(env("TG_OWNER", ""));
    let dcOwner = split(env("DISCORD_OWNER_ID", "DC_OWNER_ID"));
    if (dcOwner.length === 0) dcOwner = split(env("DC_OWNER", ""));
    if (tgOwner.length === 0) tgOwner = [...owner];
    if (dcOwner.length === 0) dcOwner = [...owner];
    return { owner, tgOwner, dcOwner };
  }

  loadJsonWithEnv(file) {
    try {
      const raw = fs.readFileSync(file, "utf8");
      const interpolated = ConfigLoader.interpolate(raw);
      const data = JSON.parse(interpolated);
      delete data._comment;
      return data;
    } catch (e) {
      if (e && e.code !== "ENOENT" && !String(e.message || "").includes("ENOENT")) {

        try { console.warn(`[config] failed to load ${path.basename(file)}: ${e.message}`); } catch {}
      }
      return null;
    }
  }

  loadModularFallback() {
    let merged = {};
    let found = false;
    for (const f of this.modularFiles) {
      const full = path.join(this.configDir, f);
      if (!fs.existsSync(full)) continue;
      const data = this.loadJsonWithEnv(full);
      if (!data || typeof data !== "object") continue;
      found = true;
      for (const k of Object.keys(data)) {
        if (
          typeof data[k] === "object" &&
          data[k] !== null &&
          !Array.isArray(data[k]) &&
          typeof merged[k] === "object" &&
          merged[k] !== null &&
          !Array.isArray(merged[k])
        ) {
          merged[k] = { ...merged[k], ...data[k] };
        } else {
          merged[k] = data[k];
        }
      }
    }
    return found ? merged : null;
  }

  resolveRaw() {

    if (fs.existsSync(this.primaryFile)) {
      const data = this.loadJsonWithEnv(this.primaryFile);
      if (data) return data;
    }

    if (fs.existsSync(this.legacyFile)) {
      const data = this.loadJsonWithEnv(this.legacyFile);
      if (data) {
        try { console.warn("[config] using legacy config/settings.json — please rename to config/config.json"); } catch {}
        return data;
      }
    }

    const mod = this.loadModularFallback();
    if (mod) {
      try { console.warn("[config] using modular config/*.json fallback — please consolidate to config/config.json"); } catch {}
      return mod;
    }
    return {};
  }

  normalize(raw) {
    const { owner, tgOwner, dcOwner } = ConfigLoader.parseOwners();

    const botname = typeof raw.botname === "string" && raw.botname.trim() ? raw.botname.trim() : "Akano";
    let prefix = raw.prefix;
    if (!Array.isArray(prefix) || prefix.length === 0) prefix = [".", "#", "!", "/"];

    if (process.env.BOT_PREFIX) {
      const p = String(process.env.BOT_PREFIX).split(",").map((s) => s.trim()).filter(Boolean);
      if (p.length) prefix = p;
    }

    const settings = { ...raw };

    try {
      const pkg = require(path.join(path.dirname(this.configDir), "package.json"));
      if (!settings.version) settings.version = pkg.version;
    } catch {}

    settings.message = settings.message || {};
    settings.whatsapp = settings.whatsapp || {};
    settings.system = settings.system || {};
    settings.security = settings.security || {};
    settings.group = settings.group || settings.whatsapp.group || {};

    if (settings.whatsapp.group && !settings.group.antilink) {

    }

    settings.connection = settings.connection || settings.whatsapp.connection || {};

    if (process.env.CODE_PAIRING) settings.connection.code_pairing = process.env.CODE_PAIRING;

    if (process.env.PAIRING_NUMBER) settings.connection.pairing_number = process.env.PAIRING_NUMBER;

    if (process.env.BROWSER) {
      try {
        const b = JSON.parse(process.env.BROWSER);
        if (Array.isArray(b)) settings.connection.browser = b;
      } catch {

      }
    }

    const proxy =
      process.env.WA_PROXY ||
      process.env.HTTPS_PROXY ||
      process.env.https_proxy ||
      process.env.HTTP_PROXY ||
      process.env.http_proxy ||
      process.env.ALL_PROXY ||
      null;
    if (proxy !== null) settings.connection.proxy = proxy;
    const noProxy = process.env.NO_PROXY || process.env.no_proxy || null;
    if (noProxy !== null) settings.connection.noProxy = noProxy;

    settings.telegram = settings.telegram || {};
    if (process.env.TELEGRAM_TOKEN) settings.telegram.token = process.env.TELEGRAM_TOKEN;

    if (tgOwner.length) {

      settings.telegram.owner = tgOwner;
    } else if (typeof settings.telegram.owner === "string" && settings.telegram.owner.trim()) {

      const s = String(settings.telegram.owner).split(",").map((x) => x.trim()).filter(Boolean);
      if (s.length) settings.telegram.owner = s;
    }

    settings.discord = settings.discord || {};
    if (process.env.DISCORD_TOKEN) settings.discord.token = process.env.DISCORD_TOKEN;
    if (process.env.DC_DAILY_LIMIT) {
      const n = parseInt(process.env.DC_DAILY_LIMIT, 10);
      if (Number.isFinite(n)) settings.discord.dailyLimit = n;
    } else if (typeof settings.discord.dailyLimit === "string") {
      const n = parseInt(settings.discord.dailyLimit, 10);
      if (Number.isFinite(n)) settings.discord.dailyLimit = n;
    }
    if (dcOwner.length) {
      settings.discord.owner = dcOwner;
    } else if (typeof settings.discord.owner === "string" && String(settings.discord.owner).trim()) {
      const s = String(settings.discord.owner).split(",").map((x) => x.trim()).filter(Boolean);
      if (s.length) settings.discord.owner = s;
    }

    settings.website = settings.website || {};
    if (process.env.DASHBOARD_PORT) {
      const n = parseInt(process.env.DASHBOARD_PORT, 10);
      if (Number.isFinite(n)) settings.website.port = n;
    }
    if (process.env.DASHBOARD_DOMAIN) settings.website.domain = process.env.DASHBOARD_DOMAIN;
    settings.website.tunnel = settings.website.tunnel || {};
    const tunnelToken = process.env.CLOUDFLARE_TUNNEL_TOKEN || process.env.TUNNEL_TOKEN || "";
    if (tunnelToken) settings.website.tunnel.token = tunnelToken;
    if (process.env.TUNNEL_DOMAIN) settings.website.tunnel.domain = process.env.TUNNEL_DOMAIN;

    if (typeof settings.website.port === "string") {
      const n = parseInt(settings.website.port, 10);
      if (Number.isFinite(n)) settings.website.port = n;
    }
    if (typeof settings.system.cooldown === "string") {
      const n = parseInt(settings.system.cooldown, 10);
      if (Number.isFinite(n)) settings.system.cooldown = n;
    }

    if (!settings.cover) settings.cover = "https://files.catbox.moe/0eklgs.jpg";
    if (!settings.footer) settings.footer = "Bot Whatsapp";
    if (!settings.fla) settings.fla = "https://www.flamingtext.com/net-fu/proxy_form.cgi?&imageoutput=true&script=sketch-name&doScale=true&scaleWidth=800&scaleHeight=500&fontsize=100&fillTextType=1&fillTextPattern=Warning!&fillColor1Color=%23b5b5b5&fillColor2Color=%23b5b5b5&fillColor3Color=%23b5b5b5&fillColor4Color=%23b5b5b5&fillColor5Color=%23b5b5b5&fillColor6Color=%23b5b5b5&fillColor7Color=%23b5b5b5&fillColor8Color=%23b5b5b5&fillColor9Color=%23b5b5b5&fillColor10Color=%23b5b5b5&fillOutlineColor=%23888888&fillOutline2Color=%23888888&backgroundColor=%23101820&text=";

    return { botname, prefix, owner, tgOwner, dcOwner, settings };
  }

  load() {
    const raw = this.resolveRaw();
    return this.normalize(raw);
  }

  loadRaw() {
    return this.resolveRaw();
  }
}

module.exports = ConfigLoader;
module.exports.ConfigLoader = ConfigLoader;
