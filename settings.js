const fs = require("fs");
const path = require("path");
const gradient = require("gradient-string");

const _env = (name, fallback) => process.env[name] || process.env[fallback] || "";

global.owner = _env("OWNER", "AKANO_OWNER")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
global.dcOwner = _env("DC_OWNER", "AKANO_DC_OWNER")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
global.tgOwner = _env("TG_OWNER", "AKANO_TG_OWNER")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
global.discord = null;
global.botname = "Akano";
global.prefix = [".", "#", "!", "/"];
global.settings = {
  cover: "https://files.catbox.moe/0eklgs.jpg",
  footer: "Bot Whatsapp",
  packname: { name: "Akano", author: "Canzy" },
  version: require(__dirname + "/package.json").version,
  message: {
    wait: "```Processing. . .```",
    errorF: "This feature is currently disabled due to a bug/error!",
    error: "Sorry, an error occurred while running this feature. Please try again later!",
    admin: "This feature is only for group admins!",
    owner: "This feature is only for the bot owner!",
    premium: "This feature is only for premium users!",
    group: "This feature can only be used in groups!",
    private: "This feature can only be used in private chat!",
    botadmin: "Please make the bot an admin before using this feature!",
    banned: "You have been banned for violating bot rules!",
    cooldown: "Please wait a moment before using this command again!",
    spam: "Slow down! You are sending commands too fast!",
    antilink: "Links are not allowed in this group!",
    antivirtex: "Long text / virtex is not allowed in this group!",
  },
  dataname: "system/database/database.json",
  sessions: "system/bot/whatsapp/sessions",
  wait: "```Processing. . .```",
  max_uploud: 50,
  dot: "◦",
  reactSW: true,
  emojis: ["❤️", "💛", "💚", "💙", "💜"],
  ownerSecurity: {
    question: "what is the name of your bot",
    answer: "akanobot",
  },
  system: {
    cooldown: 5000,
    spam: {
      resetTimer: 5000,
      holdThreshold: 5,
      permanentThreshold: 10,
      bannedThreshold: 15,
      notifyThreshold: 3,
    },
    backup: {
      enabled: true,
      intervalMs: 3600000,
      maxBackups: 7,
    },
  },
  security: {
    self: false,
    groupmode: false,
    ownerOnly: false,
    premiumOnly: false,
    bannedMessage: true,
    cooldownMessage: true,
    spamMessage: true,
  },
  group: {
    antilink: false,
    antivirtex: false,
    antidelete: false,
    welcome: true,
    left: true,
    promote: true,
    demote: true,
    welcomeThumbnail: "https://files.catbox.moe/0eklgs.jpg",
    goodbyeThumbnail: "https://files.catbox.moe/0eklgs.jpg",
    welcomeMessage: "Welcome @user to @group!\nDon't forget to read the rules!",
    goodbyeMessage: "Goodbye @user!\nWe'll miss you!",
    promoteMessage: "@user is now an admin!",
    demoteMessage: "@user is no longer an admin.",
  },
  automation: {
    autoRead: true,
    autoTyping: true,
    autoOnline: true,
    autoBackup: true,
    autoClearSession: true,
    sessionClearInterval: 3600000,
  },
  verification: {
    enabled: true,
    captchaLength: 6,
    expiresIn: 5 * 60 * 1000,
    maxAttempts: 3,
  },
  notification: {
    ownerAlert: true,
    errorAlert: true,
    spamAlert: true,
    joinAlert: true,
    leaveAlert: true,
    deleteAlert: true,
    mentionAlert: false,
  },
  limit: {
    enabled: true,
    freeUser: 15,
    premiumUser: 100,
    ownerUser: -1,
    resetTime: 86400000,
    warningMessage: "Your limit has been reached. Please wait until reset.",
  },
  afk: {
    enabled: true,
    message: "I'm currently AFK",
    reasonMessage: "Reason",
    activeMessage: "Active after AFK for {duration}",
  },
  game: {
    enabled: true,
    rpg: true,
    tournament: false,
    leaderboard: true,
    dailyReward: true,
    dailyAmount: 500,
  },
  media: {
    sticker: {
      packname: "Akano",
      author: "Canzy",
    },
    thumbnail: "https://files.catbox.moe/0eklgs.jpg",
    watermark: false,
    watermarkText: "Akano Bot",
  },
  database: {
    type: "json",
    autoSave: true,
    saveInterval: 300000,
    path: "system/database/database.json",
    backupPath: "system/database/backups",
  },
  log: {
    level: "silent",
    error: true,
    warn: true,
    info: false,
    debug: false,
    chatLog: false,
    commandLog: true,
  },
  connection: {
    code_pairing: "AKANOBOT",
    use_pairing: true,
    pairing_number: "6285729347390",
    online: true,
    presence: true,
    bypass_disappearing: true,
    browser: ["Ubuntu", "Firefox", "20.0.00"],
    shouldIgnoreJid: (jid) => {
      return /(newsletter|bot)/.test(jid);
    },
    bot: (id) => {
      return (id.startsWith("3EB0") && id.length === 40) || id.startsWith("BAE") || /[-]/.test(id);
    },
  },
  subbot: {
    sessionbot: "system/jadibot",
    AutoConnect: true,
  },
  opts: {
    autoRead: false,
    selfMode: false,
    dmOnly: false,
    groupOnly: false,
    statusOnly: false,
    queque: false,
    pending: false,
    multiprefix: true,
    noprefix: false,
  },
  telegram: {
    token: process.env.TELEGRAM_TOKEN || "TELEGRAM_TOKEN_HERE",
    owner: global.tgOwner,
    enabled: true,
    prefix: "/",
    webHook: false,
    webHookUrl: "https://your-domain.com/webhook",
    inlineMode: true,
    greeting: "Hello! I am your Telegram Bot\nUse /help to see available commands.",
    autoTyping: true,
    groupManager: {
      welcomeMessage: true,
      goodbyeMessage: true,
      autoGreeting: true,
      verification: true,
      moderation: true,
    },
  },
  discord: {
    token: process.env.DISCORD_TOKEN || "DISCORD_TOKEN_HERE",
    owner: global.dcOwner,
    dailyLimit: parseInt(
      process.env.DC_DAILY_LIMIT || process.env.AKANO_DC_DAILY_LIMIT || "200",
      10,
    ),
    presence: {
      name: "customstatus",
      type: "Custom",
      state: "Bot Active",
      status: "online",
    },
  },
};

global.syncSettings = function (db) {
  if (!db) return;
  if (!db.setting) db.setting = {};
  if (!db.users) db.users = [];
  if (!db.groups) db.groups = [];
  if (!db.chats) db.chats = [];
  const s = global.settings;
  db.setting.prefix = global.prefix;
  db.setting.antilink = s.group.antilink;
  db.setting.antivirtex = s.group.antivirtex;
  db.setting.antidelete = s.group.antidelete;
  db.setting.welcome = s.group.welcome;
  db.setting.left = s.group.left;
  db.setting.self = s.security.self;
  db.setting.groupmode = s.security.groupmode;
};

global.scraper = new (require("./system/scrapers"))("./system/scrapers/src");

try {
  global.djs = require("./system/bot/djs");
} catch (e) {
  global.djs = {};
}

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(gradient(["#FFFFFF", "#4285F4"])("Reloading file: ") + file);
  delete require.cache[file];
  if (global.reloadHandler) {
    global.reloadHandler();
  }
});
