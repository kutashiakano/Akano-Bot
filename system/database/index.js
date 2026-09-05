const fs = require("fs");
const path = require("path");
const {DatabaseSync: DatabaseSync} = require("node:sqlite");

const isNews = jid => typeof jid === "string" && /@(newsletter|broadcast)/i.test(jid);

const DEFAULTS = {
  users: {},
  chats: {},
  newsletters: [],
  telegram: {
    groups: {},
    users: {}
  },
  discord: {
    servers: {},
    users: {}
  },
  stats: {},
  msgs: {},
  sticker: {},
  settings: {},
  respon: {},
  logerror: [],
  verifications: {},
  texts: {
    welcomeMsgs: [ "Welcome @user to @subject!\nDon't forget to read the rules!", "Welcome @user!\nGlad to have you here in @subject.\nFeel free to introduce yourself and stay active!", "Hello @user!\nWelcome to @subject.\nPlease read the group description so you don't miss anything.", "Welcome aboard @user!\nYou are now part of @subject.\nSay hi and enjoy your stay!", "Hi @user!\nWelcome to @subject.\nWe hope you have a great time here.", "Welcome @user!\nThanks for joining @subject.\nDon't hesitate to ask if you need any help.", "Hey @user!\nA new member just joined @subject.\nGive them a warm welcome!", "Welcome @user!\nWe're happy to have you in @subject.\nStay active and have fun!", "Hello @user!\nWelcome to @subject.\nMake yourself at home and get to know everyone.", "Welcome @user!\nGreat to see you here in @subject.\nEnjoy your stay and keep the conversation going!" ],
    goodbyeMsgs: [ "Goodbye @user!\nWe'll miss you!", "Goodbye @user!\nThanks for being part of @subject.\nWishing you all the best!", "Goodbye @user!\nYou will be missed in @subject.\nHope to see you again soon!", "Goodbye @user!\nSorry to see you leave @subject.\nTake care and stay safe!", "Goodbye @user!\nThank you for your time in @subject.\nMay your future be bright!", "Goodbye @user!\nIt was nice having you in @subject.\nDon't be a stranger!", "Goodbye @user!\nWe appreciate your presence in @subject.\nWishing you success in everything!", "Goodbye @user!\nYou're leaving @subject, but we'll keep a good memory of you.\nTake care!", "Goodbye @user!\nFarewell from all of us in @subject.\nHope our paths cross again!", "Goodbye @user!\nWe're sad to see you go from @subject.\nStay in touch and visit us anytime!" ],
    welcomeNames: [ "Welcome", "New Member", "Meet & Greet", "Hello Corner", "Welcome Spot" ],
    welcomeAddrs: [ "Welcome to the family", "Glad you joined", "Say hello", "Make yourself at home", "Stay active and enjoy" ],
    goodbyeNames: [ "Goodbye", "Farewell", "See You Soon", "Take Care", "Best Wishes" ],
    goodbyeAddrs: [ "Come back soon", "We'll miss you", "Stay in touch", "Keep us updated", "All the best for your journey" ],
    promoteNames: [ "New Admin", "Promoted", "Leadership", "Admin Role", "Trusted Member" ],
    promoteAddrs: [ "Congratulations on your promotion", "Now an admin", "With great power comes great responsibility", "Well deserved", "Thank you for your dedication" ],
    demoteNames: [ "Admin Removed", "Demoted", "Role Changed", "Step Down", "Role Updated" ],
    demoteAddrs: [ "Thank you for your service as admin", "Back to member", "Role has been updated", "No longer an admin", "Thanks for everything" ],
    promoteMsgs: [ "@user is now an admin!", "Congratulations @user, you have been promoted to admin!", "@user is now part of the admin team!", "Big news! @user has been promoted to admin.", "Please welcome @user as the new admin!" ],
    demoteMsgs: [ "@user is no longer an admin.", "@user has been demoted from admin.", "@user's admin access has been removed.", "@user is back to being a regular member.", "Thank you for your service as admin, @user." ]
  }
};

const TEXTS_DEFAULTS = DEFAULTS.texts;

global.texts = TEXTS_DEFAULTS;

const WELCOME_TMPL = `┌─⭓「 *WELCOME USER* 」\n│ *• Meow meow!* %member just jumped into %subject!\n│ *• Time to purr together at:* %time\n└───────────────⭓`;

const LEAVE_TMPL = `┌─⭓「 *GOODBYE USER* 」\n│ *• Someone just left the den...* %subject\n│ *• Time they sneaked away:* %time\n└───────────────⭓`;

const DATA_DIR = path.join(process.cwd(), path.dirname(global.settings?.dataname || "system/database/database.json"));

const DB_FILE = path.join(DATA_DIR, "database.db");

const DB_PATH = path.join(DATA_DIR, "database.json");

const LOG_PATH = path.join(DATA_DIR, "logerror.json");

const BACKUP_DIR = path.join(DATA_DIR, "backups");

const DASHBOARD_DIR = path.join(DATA_DIR, "dashboard");

const MAX_BACKUPS = global.settings?.system?.backup?.maxBackups ?? 7;

const MAX_ERROR_LOGS = 300;

for (const p of [ DATA_DIR, BACKUP_DIR, DASHBOARD_DIR ]) {
  try {
    fs.mkdirSync(p, {
      recursive: true
    });
  } catch {}
}

for (const old of [ "dashboard-settings.json", "dashboard-auth.json", "dashboard-audit.log" ]) {
  const src = path.join(DATA_DIR, old);
  const dst = path.join(DASHBOARD_DIR, old.replace("dashboard-", ""));
  if (fs.existsSync(src) && !fs.existsSync(dst)) {
    try {
      fs.renameSync(src, dst);
    } catch {}
  }
}

const OLD_BACKUP = path.join(DATA_DIR, "backup");

if (fs.existsSync(OLD_BACKUP)) {
  try {
    fs.rmSync(OLD_BACKUP, {
      recursive: true,
      force: true
    });
  } catch {}
}

const sqlite = new DatabaseSync(DB_FILE);

sqlite.exec(`\n  PRAGMA journal_mode = WAL;\n  CREATE TABLE IF NOT EXISTS kv (\n    key TEXT PRIMARY KEY,\n    value TEXT NOT NULL\n  );\n  CREATE TABLE IF NOT EXISTS users (\n    platform TEXT NOT NULL,\n    uid TEXT NOT NULL,\n    name TEXT DEFAULT '',\n    exp INTEGER DEFAULT 0,\n    lmt INTEGER DEFAULT 100,\n    money INTEGER DEFAULT 100000,\n    registered INTEGER DEFAULT 0,\n    premium INTEGER DEFAULT 0,\n    extra TEXT DEFAULT '{}',\n    updated_at INTEGER DEFAULT 0,\n    PRIMARY KEY (platform, uid)\n  );\n`);

let cached = null;

let writeChain = Promise.resolve();

const DB_AUTOSAVE_DEBOUNCE_MS = 15e3;

const DB_AUTOSAVE_MAX_WAIT_MS = 6e4;

let _autosaveTimer = null;

let _autosaveFirstPendingAt = null;

let _autosaveInFlight = false;

let _shuttingDown = false;

let _proxiedCache = null;

const _proxyCache = new WeakMap;

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
  if (!data.telegram.users) data.telegram.users = {};
  if (!data.discord || typeof data.discord !== "object") data.discord = {};
  if (!data.discord.servers) data.discord.servers = {};
  if (!data.discord.users) data.discord.users = {};
  for (const section of [ "users", "chats", "telegram.users", "telegram.groups", "discord.users", "discord.servers" ]) {
    let obj = data;
    for (const part of section.split(".")) {
      if (!obj[part] || typeof obj[part] !== "object") obj[part] = {};
      obj = obj[part];
    }
    for (const uid of Object.keys(obj)) {
      const row = obj[uid];
      if (!row || typeof row !== "object") {
        obj[uid] = {};
        continue;
      }
      if (typeof row.exp !== "number" || isNaN(row.exp)) row.exp = 0;
      if (typeof row.limit !== "number" || isNaN(row.limit)) row.limit = 0;
      if (typeof row.money !== "number" || isNaN(row.money)) row.money = 0;
      if (typeof row.name !== "string") row.name = "";
      if (typeof row.registered !== "boolean") row.registered = !!row.registered;
      if (typeof row.premium !== "boolean") row.premium = !!row.premium;
      if (row.premium) {
        const end = Date.parse(row.premiumEnd) || 0;
        if (end && end <= Date.now()) {
          row.premium = false;
          row.premiumEnd = "";
        }
      }
    }
  }
  return data;
}

function writeFileAtomic(filePath, data) {
  const tmp = filePath + ".tmp";
  fs.mkdirSync(path.dirname(filePath), {
    recursive: true
  });
  try {
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, filePath);
  } catch (e) {
    if (String(e.message).includes("ENOENT") && String(e.message).includes("rename")) {
      try {
        fs.mkdirSync(path.dirname(filePath), {
          recursive: true
        });
        if (fs.existsSync(tmp)) fs.renameSync(tmp, filePath); else fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return;
      } catch {}
    }
    throw e;
  }
}

function backupDatabase() {
  try {
    if (!fs.existsSync(DB_PATH)) return null;
    fs.mkdirSync(BACKUP_DIR, {
      recursive: true
    });
    const name = `database-${(new Date).toISOString().replace(/[:.]/g, "-")}.json`;
    fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR, name));
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.endsWith(".json")).sort();
    const maxBackups = global.settings?.system?.backup?.maxBackups ?? MAX_BACKUPS;
    while (files.length > maxBackups) {
      fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
    }
    return path.join(BACKUP_DIR, name);
  } catch (e) {
    return null;
  }
}

const USER_COLS = [ "name", "exp", "limit", "money", "registered", "premium" ];

function pushUser(ins, platform, uid, u) {
  if (!u || typeof u !== "object") return;
  const isNum = x => typeof x === "number" && !isNaN(x);
  const extra = {};
  for (const k of Object.keys(u)) {
    if (k === "name" && typeof u[k] === "string") continue;
    if (!USER_COLS.includes(k)) extra[k] = u[k];
  }
  const defaultLimit = global.settings?.limit?.freeUser ?? 15;
  ins.run(platform, String(uid), String(u.name ?? ""), isNum(u.exp) ? u.exp : 0, isNum(u.limit) ? u.limit : u.premium ? global.settings?.limit?.premiumUser ?? 100 : defaultLimit, isNum(u.money) ? u.money : 1e5, u.registered ? 1 : 0, u.premium ? 1 : 0, JSON.stringify(extra), Date.now());
}

function isLockError(e) {
  const m = String(e && e.message || "");
  return m.includes("database is locked") || m.includes("BUSY") || String(e && e.code || "").includes("BUSY");
}

function persist(data, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      sqlite.exec("BEGIN");
      const del = sqlite.prepare("DELETE FROM users");
      const ins = sqlite.prepare(`INSERT INTO users (platform, uid, name, exp, lmt, money, registered, premium, extra, updated_at)\n         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      const upsert = sqlite.prepare(`INSERT INTO kv (key, value) VALUES (?, ?)\n         ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
      del.run();
      for (const [uid, u] of Object.entries(data.users || {})) pushUser(ins, "wa", uid, u);
      for (const [uid, u] of Object.entries(data.telegram?.users || {})) pushUser(ins, "tg", uid, u);
      for (const [uid, u] of Object.entries(data.discord?.users || {})) pushUser(ins, "dc", uid, u);
      for (const key of Object.keys(data)) {
        if (key === "users") continue;
        let val = data[key];
        if (key === "telegram" || key === "discord") {
          val = Object.assign({}, val);
          delete val.users;
        }
        try {
          upsert.run(key, JSON.stringify(val));
        } catch {}
      }
      sqlite.exec("COMMIT");
      return;
    } catch (e) {
      try {
        sqlite.exec("ROLLBACK");
      } catch {}
      if (isLockError(e) && attempt < retries) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50 * (attempt + 1));
        continue;
      }
      if (global.logError) global.logError("database.persist", e);
      return;
    }
  }
}

function load() {
  const data = ensureStructure({});
  try {
    for (const row of sqlite.prepare("SELECT key, value FROM kv").all()) {
      try {
        data[row.key] = JSON.parse(row.value);
      } catch {
        data[row.key] = Array.isArray(DEFAULTS[row.key]) ? [] : JSON.parse(JSON.stringify(DEFAULTS[row.key] || {}));
      }
    }
  } catch {}
  try {
    const ins = (_obj, uid, row) => {
      let extra = {};
      try {
        extra = JSON.parse(row.extra);
      } catch {}
      _obj[uid] = Object.assign({}, extra, {
        name: row.name || extra.name || "",
        exp: row.exp,
        limit: row.limit,
        money: row.money,
        registered: !!row.registered,
        premium: !!row.premium
      });
    };
    for (const row of sqlite.prepare("SELECT * FROM users").all()) {
      if (row.platform === "tg") ins(data.telegram.users, row.uid, row); else if (row.platform === "dc") ins(data.discord.users, row.uid, row); else ins(data.users, row.uid, row);
    }
  } catch {}
  return ensureStructure(data);
}

function migrateIfNeeded() {
  try {
    const kvCount = sqlite.prepare("SELECT COUNT(*) AS c FROM kv").get().c;
    const userCount = sqlite.prepare("SELECT COUNT(*) AS c FROM users").get().c;
    if (kvCount || userCount) return;
    if (!fs.existsSync(DB_PATH)) return;
    const data = ensureStructure(JSON.parse(fs.readFileSync(DB_PATH, "utf8")));
    persist(data);
  } catch (e) {
    if (global.logError) global.logError("database.migrate", e);
  }
}

migrateIfNeeded();

function createDeepProxy(target, onChange) {
  if (!target || typeof target !== "object") return target;
  if (target instanceof Buffer || target instanceof Date || target instanceof RegExp) return target;
  if (_proxyCache.has(target)) return _proxyCache.get(target);
  const handler = {
    get(t, prop, receiver) {
      const val = Reflect.get(t, prop, receiver);
      if (val && typeof val === "object" && !(val instanceof Buffer) && !(val instanceof Date) && !(val instanceof RegExp)) {
        return createDeepProxy(val, onChange);
      }
      return val;
    },
    set(t, prop, value, receiver) {
      const old = t[prop];
      const newVal = value && typeof value === "object" && !(value instanceof Buffer) && !(value instanceof Date) && !(value instanceof RegExp) ? createDeepProxy(value, onChange) : value;
      const res = Reflect.set(t, prop, newVal, receiver);
      if (old !== newVal) onChange();
      return res;
    },
    deleteProperty(t, prop) {
      const res = Reflect.deleteProperty(t, prop);
      onChange();
      return res;
    }
  };
  const proxy = new Proxy(target, handler);
  _proxyCache.set(target, proxy);
  _proxyCache.set(proxy, proxy);
  return proxy;
}

function scheduleAutosave() {
  if (!cached || _shuttingDown) return;
  const now = Date.now();
  if (_autosaveFirstPendingAt === null) _autosaveFirstPendingAt = now;
  if (_autosaveTimer) clearTimeout(_autosaveTimer);
  const elapsed = now - _autosaveFirstPendingAt;
  const delay = Math.min(DB_AUTOSAVE_DEBOUNCE_MS, Math.max(0, DB_AUTOSAVE_MAX_WAIT_MS - elapsed));
  _autosaveTimer = setTimeout(async () => {
    _autosaveTimer = null;
    _autosaveFirstPendingAt = null;
    if (_autosaveInFlight) {
      scheduleAutosave();
      return;
    }
    _autosaveInFlight = true;
    const snapshot = cached;
    try {
      await withLock(async () => {
        try {
          persist(snapshot);
          writeFileAtomic(DB_PATH, snapshot);
        } catch (err) {
          if (global.logError && !isLockError(err)) global.logError("db.autosave", err);
        }
      });
    } finally {
      _autosaveInFlight = false;
    }
  }, delay);
  _autosaveTimer?.unref?.();
}

async function flush() {
  if (!cached) return;
  if (_autosaveTimer) {
    clearTimeout(_autosaveTimer);
    _autosaveTimer = null;
    _autosaveFirstPendingAt = null;
  }
  if (_autosaveInFlight) return;
  _autosaveInFlight = true;
  try {
    await withLock(async () => {
      persist(cached);
      writeFileAtomic(DB_PATH, cached);
    });
  } catch (e) {
    if (!isLockError(e) && global.logError) global.logError("db.flush", e);
  } finally {
    _autosaveInFlight = false;
  }
}

function flushSync() {
  if (!cached) return;
  if (_autosaveTimer) {
    clearTimeout(_autosaveTimer);
    _autosaveTimer = null;
    _autosaveFirstPendingAt = null;
  }
  try {
    persist(cached);
    writeFileAtomic(DB_PATH, cached);
  } catch (e) {
    if (!isLockError(e) && global.logError) global.logError("db.flushSync", e);
  }
}

async function flushDatabaseAndExit(code = 0, reason = "exit") {
  if (_shuttingDown) return;
  _shuttingDown = true;
  if (_autosaveTimer) {
    clearTimeout(_autosaveTimer);
    _autosaveTimer = null;
    _autosaveFirstPendingAt = null;
  }
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("flush timeout 5s")), 5e3));
  const work = (async () => {
    if (cached) {
      await withLock(async () => {
        persist(cached);
        writeFileAtomic(DB_PATH, cached);
      });
    }
  })();
  try {
    await Promise.race([ work, timeout ]);
  } catch (e) {
    if (global.logError) global.logError("db.flushDatabaseAndExit", e);
  } finally {
    process.exit(code);
  }
}

if (!global._dbSignalBound) {
  global._dbSignalBound = true;
  process.on("SIGTERM", () => flushDatabaseAndExit(0, "SIGTERM"));
  process.on("SIGINT", () => flushDatabaseAndExit(0, "SIGINT"));
}

function get() {
  if (cached) {
    if (_proxiedCache) return _proxiedCache;
    _proxiedCache = createDeepProxy(cached, scheduleAutosave);
    return _proxiedCache;
  }
  try {
    cached = ensureStructure(load());
  } catch {
    cached = ensureStructure({});
  }
  _proxiedCache = createDeepProxy(cached, scheduleAutosave);
  return _proxiedCache;
}

function getRaw() {
  if (cached) return cached;
  try {
    cached = ensureStructure(load());
  } catch {
    cached = ensureStructure({});
  }
  return cached;
}

async function write(data) {
  const clean = ensureStructure(data || {});
  cached = clean;
  _proxiedCache = createDeepProxy(cached, scheduleAutosave);
  try {
    await withLock(async () => {
      persist(clean);
      writeFileAtomic(DB_PATH, clean);
    });
  } catch (e) {
    if (String(e.message).includes("ENOENT") && String(e.message).includes("rename")) {
      try {
        fs.writeFileSync(DB_PATH, JSON.stringify(clean, null, 2));
      } catch {}
    } else if (!isLockError(e)) {
      if (global.logError) global.logError("database.write", e);
    }
    throw e;
  }
  return _proxiedCache;
}

function update(fn) {
  const data = get();
  try {
    fn(data);
  } catch (e) {
    if (global.logError) global.logError("database.update", e);
  }
  scheduleAutosave();
  return data;
}

function query(sql, ...params) {
  return sqlite.prepare(sql).all(...params);
}

backupDatabase();

function logError(source, error) {
  try {
    const entry = {
      time: (new Date).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta"
      }),
      timestamp: Date.now(),
      source: String(source || "unknown"),
      message: error && error.message ? String(error.message) : String(error || "Unknown error"),
      stack: error && error.stack ? error.stack.split("\n").slice(0, 4).join(" | ") : ""
    };
    const exists = fs.existsSync(LOG_PATH);
    const lines = exists ? fs.readFileSync(LOG_PATH, "utf8").split("\n").filter(Boolean) : [];
    lines.push(JSON.stringify(entry));
    fs.writeFileSync(LOG_PATH, lines.slice(-MAX_ERROR_LOGS).join("\n") + "\n");
  } catch (e) {}
}

if (!global.logError) global.logError = logError;

function ensureTexts(data) {
  if (!data || typeof data !== "object") return null;
  if (!data.texts || typeof data.texts !== "object") {
    data.texts = JSON.parse(JSON.stringify(TEXTS_DEFAULTS));
  }
  return data.texts;
}

function ensureWhatsApp(data, m) {
  ensureTexts(data);
  const isNumber = x => typeof x === "number" && !isNaN(x);
  if (!m || !m.sender || typeof m.sender !== "string") return data;
  if (isNews(m.sender)) {
    if (!data.newsletters) data.newsletters = [];
    if (!data.newsletters.includes(m.sender)) data.newsletters.push(m.sender);
    return data;
  }
  if (m.sender.endsWith("@lid") || m.sender.endsWith("@g.us")) return data;
  if (!data.telegram || typeof data.telegram !== "object") data.telegram = {
    groups: {}
  };
  if (!data.discord || typeof data.discord !== "object") data.discord = {
    servers: {}
  };
  let user = data.users[m.sender];
  if (typeof user !== "object") data.users[m.sender] = {};
  if (user) {
    if (!isNumber(user.exp)) user.exp = 0;
    if (!isNumber(user.limit)) user.limit = user.premium ? global.settings?.limit?.premiumUser ?? 100 : global.settings?.limit?.freeUser ?? 15;
    if (!isNumber(user.money)) user.money = 1e5;
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
      limit: global.settings?.limit?.freeUser ?? 15,
      money: 1e4,
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
      hit: 0
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
      leaveMsg: LEAVE_TMPL
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
      start: 0
    };
  }
  return data;
}

function ensureTelegram(data, ctx) {
  ensureTexts(data);
  if (!data.telegram || typeof data.telegram !== "object") data.telegram = {
    groups: {},
    users: {}
  };
  if (!data.telegram.groups) data.telegram.groups = {};
  if (!data.telegram.users) data.telegram.users = {};
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
        createdAt: (new Date).toISOString()
      };
    }
    const group = data.telegram.groups[groupId];
    if (!group.members) group.members = {};
    if (ctx.from) {
      group.members[ctx.from.id] = {
        id: ctx.from.id,
        username: ctx.from.username || null,
        first_name: ctx.from.first_name || "User"
      };
    }
  }
  return data;
}

function ensureDiscord(data, ctx) {
  ensureTexts(data);
  if (!data.discord || typeof data.discord !== "object") data.discord = {
    servers: {},
    users: {}
  };
  if (!data.discord.servers) data.discord.servers = {};
  if (!data.discord.users) data.discord.users = {};
  const guildId = ctx && ctx.guildId;
  if (guildId) {
    if (!data.discord.servers[guildId]) {
      data.discord.servers[guildId] = {
        id: guildId,
        name: ctx.guild && ctx.guild.name || "",
        members: {},
        settings: {},
        createdAt: (new Date).toISOString()
      };
    }
  }
  return data;
}

module.exports = {
  path: DB_PATH,
  file: DB_FILE,
  get: get,
  getRaw: getRaw,
  write: write,
  update: update,
  withLock: withLock,
  ensureStructure: ensureStructure,
  writeFileAtomic: writeFileAtomic,
  backupDatabase: backupDatabase,
  DEFAULTS: DEFAULTS,
  TEXTS_DEFAULTS: TEXTS_DEFAULTS,
  defaultTexts: TEXTS_DEFAULTS,
  ensureTexts: ensureTexts,
  ensureWhatsApp: ensureWhatsApp,
  ensureTelegram: ensureTelegram,
  ensureDiscord: ensureDiscord,
  logError: logError,
  query: query,
  scheduleAutosave: scheduleAutosave,
  flush: flush,
  flushSync: flushSync,
  flushDatabaseAndExit: flushDatabaseAndExit
};