const fs = require("fs");
const path = require("path");
const os = require("os");

const DB_DIR = path.join(process.cwd(), "system", "database");

const DB_FILE = path.join(DB_DIR, "database.json");

const BACKUP_DIR = path.join(DB_DIR, "backups");

const MAX_DB_BACKUPS = 10;

const failedQueue = new Map;

let terminalLines = [];

const TERMINAL_MAX = 300;

let restartHour = null;

let restartInterval = null;

let hooksInstalled = false;

function ensureBackupDir() {
  fs.mkdirSync(BACKUP_DIR, {
    recursive: true
  });
}

function createBackup() {
  ensureBackupDir();
  if (!fs.existsSync(DB_FILE)) return null;
  const stamp = (new Date).toISOString().replace(/[:.]/g, "-");
  const dest = path.join(BACKUP_DIR, `db-${stamp}.json`);
  fs.copyFileSync(DB_FILE, dest);
  const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("db-")).sort();
  while (files.length > MAX_DB_BACKUPS) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
  return dest;
}

function listDbBackups() {
  ensureBackupDir();
  return fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("db-") && f.endsWith(".json")).sort().reverse().map(f => {
    const st = fs.statSync(path.join(BACKUP_DIR, f));
    return {
      file: f,
      ts: st.mtimeMs,
      size: st.size
    };
  });
}

function restoreDb(file) {
  const safe = path.basename(String(file || ""));
  if (!/^db-[\dT:\-.Z]+\.json$/.test(safe)) throw new Error("invalid backup id");
  const full = path.join(BACKUP_DIR, safe);
  if (!fs.existsSync(full)) throw new Error("backup not found");
  JSON.parse(fs.readFileSync(full, "utf8"));
  fs.copyFileSync(full, DB_FILE);
  return true;
}

function checkIntegrity() {
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    JSON.parse(raw);
    return {
      valid: true,
      size: Buffer.byteLength(raw)
    };
  } catch (e) {
    return {
      valid: false,
      error: e.message
    };
  }
}

function healthCheck() {
  const waSock = global.sock;
  const dc = global.discordBot && global.discordBot.client;
  const tg = global.telegramBot && global.telegramBot.bot;
  return {
    whatsapp: waSock ? waSock.user ? {
      state: "linked",
      label: "Linked"
    } : {
      state: "connecting",
      label: "Connecting"
    } : {
      state: "off",
      label: "Off"
    },
    discord: dc ? dc.readyAt ? {
      state: "ready",
      label: "Ready"
    } : {
      state: "connecting",
      label: "Connecting"
    } : {
      state: "off",
      label: "Off"
    },
    telegram: tg ? {
      state: "online",
      label: "Online"
    } : {
      state: "off",
      label: "Off"
    }
  };
}

function addFailed(platform, target, text, error) {
  if (!failedQueue.has(platform)) failedQueue.set(platform, []);
  const arr = failedQueue.get(platform);
  arr.push({
    target: target,
    text: String(text).slice(0, 200),
    error: String(error).slice(0, 120),
    ts: Date.now()
  });
  if (arr.length > 100) arr.shift();
}

function getFailed() {
  const out = {};
  for (const [k, v] of failedQueue) out[k] = v;
  return out;
}

function clearFailed(platform) {
  if (platform) failedQueue.delete(platform); else failedQueue.clear();
}

function dirSize(dir, depth = 0) {
  if (depth > 3) return {
    size: 0,
    count: 0
  };
  let size = 0, count = 0;
  try {
    for (const e of fs.readdirSync(dir, {
      withFileTypes: true
    })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        const sub = dirSize(full, depth + 1);
        size += sub.size;
        count += sub.count;
      } else {
        const st = fs.statSync(full);
        size += st.size;
        count++;
      }
    }
  } catch {}
  return {
    size: size,
    count: count
  };
}

function getStorageStats() {
  const dirs = [ {
    name: "tmp/",
    p: path.join(process.cwd(), "tmp")
  }, {
    name: "audio cache",
    p: path.join(process.cwd(), "tmp", "audio_cache")
  }, {
    name: "ytsession",
    p: path.join(process.cwd(), "tmp", "ytsession")
  }, {
    name: "database",
    p: DB_DIR
  }, {
    name: "wa sessions",
    p: path.join(process.cwd(), "system", "bot", "whatsapp", "sessions")
  }, {
    name: "db backups",
    p: BACKUP_DIR
  } ];
  const results = [];
  let totalSize = 0;
  for (const d of dirs) {
    const {size: size, count: count} = dirSize(d.p);
    totalSize += size;
    results.push({
      name: d.name,
      path: d.p.replace(process.cwd() + "/", ""),
      sizeMB: +(size / 1048576).toFixed(2),
      fileCount: count
    });
  }
  const sysFree = os.freemem();
  const sysTotal = os.totalmem();
  return {
    dirs: results,
    totalSizeMB: +(totalSize / 1048576).toFixed(2),
    systemFree: sysFree,
    systemTotal: sysTotal,
    usedPct: Math.round((sysTotal - sysFree) / sysTotal * 100)
  };
}

function initTerminalCapture() {
  if (hooksInstalled) return;
  hooksInstalled = true;
  const origOut = process.stdout.write.bind(process.stdout);
  const origErr = process.stderr.write.bind(process.stderr);
  process.stdout.write = function(...args) {
    const str = typeof args[0] === "string" ? args[0] : "";
    if (str) {
      terminalLines.push({
        type: "out",
        text: str.slice(0, 500),
        ts: Date.now()
      });
      if (terminalLines.length > TERMINAL_MAX) terminalLines.shift();
    }
    return origOut(...args);
  };
  process.stderr.write = function(...args) {
    const str = typeof args[0] === "string" ? args[0] : "";
    if (str) {
      terminalLines.push({
        type: "err",
        text: str.slice(0, 500),
        ts: Date.now()
      });
      if (terminalLines.length > TERMINAL_MAX) terminalLines.shift();
    }
    return origErr(...args);
  };
}

function getLines(n = 100) {
  return terminalLines.slice(-n);
}

function setSchedule(hour) {
  restartHour = hour;
  if (restartInterval) clearInterval(restartInterval);
  restartInterval = setInterval(() => {
    if (restartHour !== null && (new Date).getHours() === restartHour) {
      if (typeof process.send === "function") process.send("reset"); else process.exit(0);
    }
  }, 6e4);
  restartInterval.unref();
}

function getSchedule() {
  return restartHour;
}

function clearSchedule() {
  restartHour = null;
  if (restartInterval) clearInterval(restartInterval);
}

function retryItem(platform, index) {
  const arr = failedQueue.get(platform);
  if (!arr || !arr[index]) throw new Error("item not found");
  const item = arr[index];
  arr.splice(index, 1);
  if (platform === "whatsapp") {
    const sock = global.sock;
    if (!sock) throw new Error("WhatsApp offline");
    return sock.sendMessage(item.target, {
      text: item.text
    });
  }
  if (platform === "telegram") {
    const tg = global.telegramBot && global.telegramBot.bot;
    if (!tg) throw new Error("Telegram offline");
    return tg.telegram.sendMessage(item.target, item.text);
  }
  if (platform === "discord") {
    const dc = global.discordBot && global.discordBot.client;
    if (!dc) throw new Error("Discord offline");
    return dc.channels.fetch(item.target).then(ch => ch.send(item.text));
  }
}

module.exports = {
  init() {
    ensureBackupDir();
    initTerminalCapture();
  },
  createBackup: createBackup,
  listDbBackups: listDbBackups,
  restoreDb: restoreDb,
  checkIntegrity: checkIntegrity,
  healthCheck: healthCheck,
  addFailed: addFailed,
  getFailed: getFailed,
  clearFailed: clearFailed,
  retryItem: retryItem,
  getStorageStats: getStorageStats,
  setSchedule: setSchedule,
  getSchedule: getSchedule,
  clearSchedule: clearSchedule,
  getLines: getLines
};