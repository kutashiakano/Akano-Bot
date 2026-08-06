const fs = require("fs");
const path = require("path");
const { isJidNewsletter } = require("baileys");

const DEFAULTS = {
  users: {},
  chats: {},
  newsletters: [],
  telegram: { groups: {} },
  discord: { servers: {} },
  stats: {},
  msgs: {},
  sticker: {},
  settings: {},
  respon: {},
  logerror: [],
  texts: {
    welcomeMsgs: [
      "Welcome @user to @subject!\nDon't forget to read the rules!",
      "Welcome @user!\nGlad to have you here in @subject.\nFeel free to introduce yourself and stay active!",
      "Hello @user!\nWelcome to @subject.\nPlease read the group description so you don't miss anything.",
      "Welcome aboard @user!\nYou are now part of @subject.\nSay hi and enjoy your stay!",
      "Hi @user!\nWelcome to @subject.\nWe hope you have a great time here.",
      "Welcome @user!\nThanks for joining @subject.\nDon't hesitate to ask if you need any help.",
      "Hey @user!\nA new member just joined @subject.\nGive them a warm welcome!",
      "Welcome @user!\nWe're happy to have you in @subject.\nStay active and have fun!",
      "Hello @user!\nWelcome to @subject.\nMake yourself at home and get to know everyone.",
      "Welcome @user!\nGreat to see you here in @subject.\nEnjoy your stay and keep the conversation going!",
    ],
    goodbyeMsgs: [
      "Goodbye @user!\nWe'll miss you!",
      "Goodbye @user!\nThanks for being part of @subject.\nWishing you all the best!",
      "Goodbye @user!\nYou will be missed in @subject.\nHope to see you again soon!",
      "Goodbye @user!\nSorry to see you leave @subject.\nTake care and stay safe!",
      "Goodbye @user!\nThank you for your time in @subject.\nMay your future be bright!",
      "Goodbye @user!\nIt was nice having you in @subject.\nDon't be a stranger!",
      "Goodbye @user!\nWe appreciate your presence in @subject.\nWishing you success in everything!",
      "Goodbye @user!\nYou're leaving @subject, but we'll keep a good memory of you.\nTake care!",
      "Goodbye @user!\nFarewell from all of us in @subject.\nHope our paths cross again!",
      "Goodbye @user!\nWe're sad to see you go from @subject.\nStay in touch and visit us anytime!",
    ],
    welcomeNames: ["Welcome", "New Member", "Meet & Greet", "Hello Corner", "Welcome Spot"],
    welcomeAddrs: ["Welcome to the family", "Glad you joined", "Say hello", "Make yourself at home", "Stay active and enjoy"],
    goodbyeNames: ["Goodbye", "Farewell", "See You Soon", "Take Care", "Best Wishes"],
    goodbyeAddrs: ["Come back soon", "We'll miss you", "Stay in touch", "Take care out there", "All the best for your journey"],
    promoteNames: ["New Admin", "Promoted", "Leadership", "Admin Role", "Trusted Member"],
    promoteAddrs: ["Congratulations on your promotion", "Now an admin", "With great power comes great responsibility", "Well deserved", "Thank you for your dedication"],
    demoteNames: ["Admin Removed", "Demoted", "Role Changed", "Step Down", "Role Updated"],
    demoteAddrs: ["Thank you for your service as admin", "Back to member", "Role has been updated", "No longer an admin", "Thanks for everything"],
    promoteMsgs: [
      "@user is now an admin!",
      "Congratulations @user, you have been promoted to admin!",
      "@user is now part of the admin team!",
      "Big news! @user has been promoted to admin.",
      "Please welcome @user as the new admin!",
    ],
    demoteMsgs: [
      "@user is no longer an admin.",
      "@user has been demoted from admin.",
      "@user's admin access has been removed.",
      "@user is back to being a regular member.",
      "Thank you for your service as admin, @user.",
    ],
  },
};

const TEXTS_DEFAULTS = DEFAULTS.texts;

global.texts = TEXTS_DEFAULTS;

const WELCOME_TMPL = `┌─⭓「 *WELCOME USER* 」\n│ *• Meow meow!* %member just jumped into %subject!\n│ *• Time to purr together at:* %time\n└───────────────⭓`;
const LEAVE_TMPL = `┌─⭓「 *GOODBYE USER* 」\n│ *• Someone just left the den...* %subject\n│ *• Time they sneaked away:* %time\n└───────────────⭓`;

const DB_PATH = path.join(
  process.cwd(),
  global.settings?.dataname || "system/database/database.json"
);

const BACKUP_DIR = path.join(path.dirname(DB_PATH), "backup");
const MAX_BACKUPS = 10;

let writeChain = Promise.resolve();

function withLock(fn) {
  const run = writeChain.then(() => fn());
  writeChain = run.catch(() => {});
  return run;
}

function ensureStructure(data) {
  if (typeof data !== "object" || data === null) data = {};
  for (const key of Object.keys(DEFAULTS)) {
    if (typeof data[key] !== "object" || data[key] === null) {
      data[key] = Array.isArray(DEFAULTS[key]) ? [] : JSON.parse(JSON.stringify(DEFAULTS[key]));
    }
  }
  if (!data.telegram || typeof data.telegram !== "object") data.telegram = {};
  if (!data.telegram.groups) data.telegram.groups = {};
  if (!data.discord || typeof data.discord !== "object") data.discord = {};
  if (!data.discord.servers) data.discord.servers = {};
  return data;
}

function writeFileAtomic(filePath, data) {
  const tmp = filePath + ".tmp";
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function backupDatabase() {
  try {
    if (!fs.existsSync(DB_PATH)) return null;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const name = `database-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR, name));
    const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".json")).sort();
    while (files.length > MAX_BACKUPS) {
      fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
    }
    return path.join(BACKUP_DIR, name);
  } catch (e) {
    return null;
  }
}

function get() {
  try {
    const data = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    return ensureStructure(data);
  } catch {
    try {
      const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.endsWith(".json")).sort();
      if (files.length) {
        const data = JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, files[files.length - 1]), "utf8"));
        return ensureStructure(data);
      }
    } catch {}
    return ensureStructure({});
  }
}

function write(data) {
  return withLock(() => {
    writeFileAtomic(DB_PATH, data);
  });
}

function update(fn) {
  return withLock(() => {
    const data = get();
    fn(data);
    write(data);
    return data;
  });
}

function ensureTexts(data) {
  if (!data || typeof data !== "object") return null;
  if (!data.texts || typeof data.texts !== "object") {
    data.texts = JSON.parse(JSON.stringify(TEXTS_DEFAULTS));
  }
  return data.texts;
}

const MAX_ERROR_LOGS = 300;

function logError(source, error) {
  try {
    const entry = {
      time: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
      timestamp: Date.now(),
      source: String(source || "unknown"),
      message: error && error.message ? String(error.message) : String(error || "Unknown error"),
      stack: error && error.stack ? error.stack.split("\n").slice(0, 4).join(" | ") : "",
    };
    const data = global.db?.data || get();
    if (!data || typeof data !== "object") return;
    if (!Array.isArray(data.logerror)) data.logerror = [];
    data.logerror.push(entry);
    if (data.logerror.length > MAX_ERROR_LOGS) data.logerror = data.logerror.slice(-MAX_ERROR_LOGS);
    if (!global.db?.data) write(data);
  } catch (e) {}
}

global.logError = logError;

backupDatabase();

function ensureWhatsApp(data, m) {
  ensureTexts(data);
  const isNumber = (x) => typeof x === "number" && !isNaN(x);

  if (!m || !m.sender || typeof m.sender !== "string") return data;

  if (isJidNewsletter(m.sender)) {
    if (!data.newsletters) data.newsletters = [];
    if (!data.newsletters.includes(m.sender)) data.newsletters.push(m.sender);
    return data;
  }

  if (m.sender.endsWith("@lid") || m.sender.endsWith("@g.us")) return data;

  if (!data.telegram || typeof data.telegram !== "object") data.telegram = { groups: {} };
  if (!data.discord || typeof data.discord !== "object") data.discord = { servers: {} };

  let user = data.users[m.sender];
  if (typeof user !== "object") data.users[m.sender] = {};
  if (user) {
    if (!isNumber(user.exp)) user.exp = 0;
    if (!isNumber(user.limit)) user.limit = 100;
    if (!isNumber(user.money)) user.money = 100000;
    if (!("registered" in user)) user.registered = false;
    if (!("premium" in user)) user.premium = false;
    if (!("moderator" in user)) user.moderator = false;
    if (!user.registered) {
      if (!("name" in user)) user.name = m.name;
      if (!isNumber(user.age)) user.age = 0;
      if (!isNumber(user.level)) user.level = 0;
      if (!isNumber(user.regTime)) user.regTime = 0;
      if (!isNumber(user.warn)) user.warn = 0;
    }
    if (!isNumber(user.online)) user.online = Date.now();
    if (!isNumber(user.hit)) user.hit = 0;
  } else {
    data.users[m.sender] = {
      exp: 0,
      limit: 100,
      money: 10000,
      registered: false,
      name: m.name,
      age: "-",
      regTime: 0,
      banned: false,
      premium: false,
      moderator: false,
      level: 1,
      role: "Nothing",
      warn: 0,
      online: Date.now(),
      hit: 0,
    };
  }

  let chat = data.chats[m.chat];
  if (!m.isGroup) return data;
  if (typeof chat !== "object") data.chats[m.chat] = {};

  if (!data.chats[m.chat]) {
    data.chats[m.chat] = {};
  }

  if (chat) {
    if (!("isBanned" in chat)) chat.isBanned = false;
    if (!("welcome" in chat)) chat.welcome = true;
    if (!("left" in chat)) chat.left = true;
    if (!("mute" in chat)) chat.mute = false;
    if (!("sewa" in chat)) chat.sewa = false;
    if (!("member" in chat)) chat.member = [];
    if (!("antiDelete" in chat)) chat.antiDelete = [];
    if (!("welcomeMsg" in chat)) chat.welcomeMsg = WELCOME_TMPL;
    if (!("leaveMsg" in chat)) chat.leaveMsg = LEAVE_TMPL;
    if (!isNumber(chat.chat)) chat.chat = 0;
    if (!isNumber(chat.expired)) chat.expired = 0;
  } else {
    data.chats[m.chat] = {
      welcome: true,
      left: true,
      antiLink: true,
      sewa: false,
      mute: false,
      member: [],
      chat: 0,
      expired: 0,
      welcomeMsg: WELCOME_TMPL,
      leaveMsg: LEAVE_TMPL,
    };
  }

  let settings = data.settings;
  if (typeof settings !== "object") data.settings = {};
  if (settings) {
    if (!("blockcmd" in settings)) settings.blockcmd = [];
    if (!isNumber(settings.start)) settings.start = 0;
  } else {
    data.settings = {
      blockcmd: [],
      start: 0,
    };
  }

  return data;
}

function ensureTelegram(data, ctx) {
  ensureTexts(data);
  if (!data.telegram || typeof data.telegram !== "object") data.telegram = { groups: {} };
  if (!data.telegram.groups) data.telegram.groups = {};

  const chat = ctx && ctx.chat;
  if (chat && (chat.type === "group" || chat.type === "supergroup")) {
    const groupId = chat.id;
    if (!data.telegram.groups[groupId]) {
      data.telegram.groups[groupId] = {
        id: groupId,
        title: chat.title,
        welcomeMessage: true,
        goodbyeMessage: true,
        autoGreeting: true,
        verification: true,
        moderation: true,
        members: {},
        warnings: {},
        antiflood: false,
        antispam: false,
        antiarab: false,
        antitagall: false,
        antiraid: false,
        createdAt: new Date().toISOString(),
      };
    }

    const group = data.telegram.groups[groupId];
    if (!group.members) group.members = {};
    if (ctx.from) {
      group.members[ctx.from.id] = {
        id: ctx.from.id,
        username: ctx.from.username || null,
        first_name: ctx.from.first_name || "User",
      };
    }
  }

  return data;
}

function ensureDiscord(data, ctx) {
  ensureTexts(data);
  if (!data.discord || typeof data.discord !== "object") data.discord = { servers: {} };
  if (!data.discord.servers) data.discord.servers = {};

  const guildId = ctx && ctx.guildId;
  if (guildId) {
    if (!data.discord.servers[guildId]) {
      data.discord.servers[guildId] = {
        id: guildId,
        name: (ctx.guild && ctx.guild.name) || "",
        members: {},
        settings: {},
        createdAt: new Date().toISOString(),
      };
    }
  }

  return data;
}

module.exports = {
  path: DB_PATH,
  get,
  write,
  update,
  withLock,
  ensureStructure,
  writeFileAtomic,
  backupDatabase,
  DEFAULTS,
  TEXTS_DEFAULTS,
  defaultTexts: TEXTS_DEFAULTS,
  ensureTexts,
  ensureWhatsApp,
  ensureTelegram,
  ensureDiscord,
  logError,
};