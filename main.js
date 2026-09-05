const path = require("path");
const fs = require("fs");
const chalk = require("chalk");

const logErrorPath = path.join(__dirname, "system", "database", "logerror.json");

const logOldPath = path.join(__dirname, "system", "database", "logerror.old.json");

const logDir = path.dirname(logErrorPath);

if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, {
  recursive: true
});

if (!fs.existsSync(logErrorPath)) fs.writeFileSync(logErrorPath, "");

const BAILEYS_MARKERS = [ "/baileys/", "@whiskeysockets/baileys", "/baileys-caller/" ];

const IGNORED_ERRORS = [ "isZero", "toJSON", "writeToFile", "reading 'child'", "makeNoiseHandler", "Cannot read properties of undefined", "noise-handler", "socket.js", "Stream Errored", "Connection Closed", "Bad MAC", "Failed to decrypt", "SessionEntry", "Closing session", "write EPIPE", "EPIPE", "stream_base_commons" ];

const IGNORED_MESSAGES = [ "Connection Closed", "Failed to request pairing code", "Closing session", "SessionEntry", "Expected token to be set", "getaddrinfo ENOTFOUND", "WebSocket Error", "ctx.chatAct is not a function", "Class constructor ModalBuilder", "Cannot find module '../../music/utils'" ];

const MAX_LOG_SIZE = 1024 * 1024;

const MAX_ENTRIES = 2e3;

let errorCount = 0;

function toWib(iso) {
  try {
    return new Date(iso).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta"
    });
  } catch {
    return (new Date).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta"
    });
  }
}

function shortPath(p) {
  return String(p || "").split(process.cwd() + "/").pop() || String(p || "");
}

function rotateIfNeeded() {
  try {
    if (fs.existsSync(logErrorPath) && fs.statSync(logErrorPath).size > MAX_LOG_SIZE) {
      fs.copyFileSync(logErrorPath, logOldPath);
      fs.writeFileSync(logErrorPath, "");
    }
  } catch {}
}

function extractOrigin(stackLines) {
  for (const l of stackLines) {
    const m = l.match(/\(([^)]+):(\d+):\d+\)/);
    if (m) return `${shortPath(m[1])}:${m[2]}`;
  }
  return "-";
}

function buildEntry(source, err, extraArgs) {
  errorCount++;
  const iso = (new Date).toISOString();
  const message = err instanceof Error ? err.message || String(err) : String(err);
  const name = err instanceof Error ? err.name : err && err.constructor ? err.constructor.name : "Error";
  let stack = err instanceof Error && err.stack ? err.stack.split("\n").map(l => l.trim()).filter(Boolean) : [];
  if (stack[0] && message && stack[0].includes(message.slice(0, 40))) stack.shift();
  const mem = process.memoryUsage();
  return {
    id: errorCount,
    ts: iso,
    wib: toWib(iso),
    source: String(source || "unknown"),
    name: name,
    code: err && err.code ? String(err.code) : null,
    message: message,
    origin: extractOrigin(stack),
    stack: stack.slice(0, MAX_ENTRIES ? 40 : 40),
    args: extraArgs || [],
    pid: process.pid,
    uptimeSec: Math.floor(process.uptime()),
    platform: process.platform,
    node: process.version,
    memory: {
      rss: +(mem.rss / 1024 / 1024).toFixed(1),
      heapUsed: +(mem.heapUsed / 1024 / 1024).toFixed(1),
      heapTotal: +(mem.heapTotal / 1024 / 1024).toFixed(1)
    }
  };
}

function isBaileysInternalError(err) {
  if (!err) return false;
  const stack = err.stack || "";
  const msg = err.message || "";
  if (IGNORED_MESSAGES.some(m => msg.includes(m))) return true;
  const isBaileys = BAILEYS_MARKERS.some(m => stack.includes(m));
  if (!isBaileys) return false;
  return IGNORED_ERRORS.some(e => msg.includes(e) || stack.includes(e));
}

function isIgnoredMessage(err) {
  if (!err) return false;
  const msg = err.message || String(err) || "";
  const stack = err.stack || "";
  const combined = msg + " " + stack;
  if (combined.includes("write EPIPE") || combined.includes("EPIPE") || combined.includes("stream_base_commons") || combined.includes("process.stderr.write")) return true;
  return IGNORED_MESSAGES.some(m => combined.includes(m));
}

function trimLogFile() {
  try {
    const lines = fs.readFileSync(logErrorPath, "utf8").split("\n").filter(Boolean);
    if (lines.length > MAX_ENTRIES) {
      fs.writeFileSync(logErrorPath, lines.slice(-MAX_ENTRIES).join("\n") + "\n");
    }
  } catch {}
}

function writeLogEntry(source, err, extraArgs) {
  if (isBaileysInternalError(err) || isIgnoredMessage(err)) return;
  const msgCheck = String(err && err.message || err || "") + " " + String(err && err.stack || "");
  if (msgCheck.includes("write EPIPE") || msgCheck.includes("EPIPE") || msgCheck.includes("stream_base_commons")) return;
  if (msgCheck.includes("[UNCAUGHT] write EPIPE")) return;
  try {
    rotateIfNeeded();
    const entry = buildEntry(source, err, extraArgs);
    fs.appendFileSync(logErrorPath, JSON.stringify(entry) + "\n");
    trimLogFile();
    if (typeof global.__botEvent === "function") {
      try {
        global.__botEvent({
          type: "log",
          data: {
            level: /warn|rate|limit|stuck/i.test(source) ? "warn" : "error",
            source: entry.source,
            message: String(entry.message || "").slice(0, 400),
            origin: entry.origin
          }
        });
      } catch {}
    }
  } catch {}
}

function readLogErrors(limit) {
  try {
    const lines = fs.readFileSync(logErrorPath, "utf8").split("\n").filter(Boolean);
    const out = [];
    for (const l of lines) {
      try {
        out.push(JSON.parse(l));
      } catch {}
    }
    if (limit && limit > 0) return out.slice(-limit);
    return out;
  } catch {
    return [];
  }
}

function logError(source, err) {
  const msgCheck = String(err && err.message || err || "") + " " + String(err && err.stack || "");
  if (msgCheck.includes("write EPIPE") || msgCheck.includes("EPIPE") || msgCheck.includes("stream_base_commons")) return;
  writeLogEntry(source, err);
  try {
    console.error(`[${source}]`, err instanceof Error ? err.message : err);
  } catch {}
}

global.logError = logError;

global.getLogErrors = readLogErrors;

global.logErrorPath = logErrorPath;

const _origConsoleError = console.error.bind(console);

console.error = function(...args) {
  const firstArg = args[0];
  const joined = args.map(a => a instanceof Error ? a.message || a.stack || String(a) : typeof a === "string" ? a : "").join(" ");
  if (joined.includes("write EPIPE") || joined.includes("EPIPE") || joined.includes("stream_base_commons") || joined.includes("process.stderr.write")) return;
  if (IGNORED_MESSAGES.some(m => joined.includes(m))) return;
  if (typeof firstArg === "string" && IGNORED_ERRORS.some(e => firstArg.includes(e))) return;
  if (typeof firstArg === "string" && (firstArg.includes("MaxListenersExceeded") || firstArg.includes("uncaughtException listeners") || firstArg.includes("unhandledRejection listeners"))) return;
  if (firstArg instanceof Error && (isBaileysInternalError(firstArg) || isIgnoredMessage(firstArg))) return;
  try {
    writeLogEntry("CONSOLE_ERROR", new Error(args.map(a => a instanceof Error ? a.stack || a.message || String(a) : typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")));
  } catch {}
  try {
    _origConsoleError(...args);
  } catch {}
};

process.on("uncaughtException", err => {
  const msgCheck = String(err && err.message || err || "") + " " + String(err && err.stack || "");
  if (msgCheck.includes("write EPIPE") || msgCheck.includes("EPIPE") || msgCheck.includes("stream_base_commons")) return;
  if (isBaileysInternalError(err) || isIgnoredMessage(err)) return;
  logError("UNCAUGHT", err);
});

process.on("unhandledRejection", err => {
  const msgCheck = String(err && err.message || err || "") + " " + String(err && err.stack || "");
  if (msgCheck.includes("write EPIPE") || msgCheck.includes("EPIPE") || msgCheck.includes("stream_base_commons")) return;
  if (isBaileysInternalError(err) || isIgnoredMessage(err)) return;
  logError("UNHANDLED", err);
});

process.on("warning", warn => {
  const msg = warn?.message || String(warn);
  if (msg.includes("MaxListenersExceeded") || msg.includes("DEP0") || msg.includes("SQLite") || msg.includes("sqlite")) return;
  logError("WARNING", warn);
});

require("./settings");

const args = process.argv.slice(2);

const flags = args.filter(a => a.startsWith("--"));

const hasFlag = name => flags.includes(`--${name}`);

function showHelp() {
  const line = "=".repeat(50);
  console.log(line);
  console.log("  " + global.botname + " v" + (global.settings?.version || "1.0.0"));
  console.log("  Multi-Platform Bot: WhatsApp / Discord / Telegram");
  console.log(line);
  console.log("");
  console.log("  USAGE");
  console.log("    node index.js [options]");
  console.log("    node . [options]");
  console.log("");
  console.log("  OPTIONS");
  console.log("    --whatsapp    Start WhatsApp bot only");
  console.log("    --discord     Start Discord bot only");
  console.log("    --telegram    Start Telegram bot only");
  console.log("    --all         Start all bots simultaneously");
  console.log("    --help        Show this help message");
  console.log("");
  console.log("  NPM SCRIPTS");
  console.log("    npm start       Start all bots");
  console.log("    npm run wa      Start WhatsApp only");
  console.log("    npm run dc      Start Discord only");
  console.log("    npm run tg      Start Telegram only");
  console.log("    npm run help    Show help");
  console.log("");
  console.log("  SETUP");
  console.log("    1. Export secrets in ~/.akano-env (DISCORD_TOKEN, TELEGRAM_TOKEN, ID_OWNER, MEM_LIMIT_MB)");
  console.log("    2. Run: npm install");
  console.log("    3. Run: npm start");
  console.log("");
  console.log("  FEATURES");
  console.log("    - Music player (Spotify / YouTube)");
  console.log("    - AI chat (Gemini)");
  console.log("    - Media downloader (YT, TikTok, IG, X, FB, etc.)");
  console.log("    - Moderation (kick, ban, mute, warn)");
  console.log("    - Group management (welcome, antispam)");
  console.log("");
  console.log("  ERROR LOG");
  console.log("    Errors are saved to: system/database/logerror.json (NDJSON)");
  console.log(line);
}

if (hasFlag("help") || flags.length === 0) {
  showHelp();
  process.exit(0);
}

const startWA = hasFlag("whatsapp") || hasFlag("all");

const startDC = hasFlag("discord") || hasFlag("all");

const _tgDisabledEnv = (() => {
  const v = String(process.env.TELEGRAM_ENABLED || process.env.TELEGRAM_POLLING || "").toLowerCase();
  if (v === "0" || v === "false" || v === "off" || v === "disabled") return true;
  const v2 = String(process.env.DISABLE_TELEGRAM || process.env.DISABLE_TG || "").toLowerCase();
  if (v2 === "1" || v2 === "true" || v2 === "yes") return true;
  return false;
})();
const startTG = (hasFlag("telegram") || hasFlag("all")) && !_tgDisabledEnv;
if (_tgDisabledEnv && (hasFlag("telegram") || hasFlag("all"))) {
  console.log("[main] Telegram disabled via env (TELEGRAM_ENABLED=false or DISABLE_TELEGRAM=1) — polling will be skipped. Run TG only on ONE instance to avoid 409 Conflict.");
}

global.waExclusive = startWA && !startDC && !startTG;

require("./system/core/watchdog").memWatch();

require("./system/core/cleaner").start();

try {
  const {startReloadSystem: startReloadSystem} = require("./system/core/reload");
  startReloadSystem();
} catch (e) {
  console.error("[reload] init failed:", e.message);
}

try {
  require("./system/bot/website").init();
} catch (e) {
  console.error("[dashboard] skipped:", e.message);
}

if (startWA) require("./system/bot/whatsapp/lib/start")();

if (startDC) require("./system/bot/discord/start")();

if (startTG) require("./system/bot/telegram/start")();

let _mainShuttingDown = false;

async function flushDatabaseAndExit(code, signal) {
  if (_mainShuttingDown) return;
  _mainShuttingDown = true;
  console.log(`[main] ${signal || "exit"} received, flushing database...`);
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error("flush timeout 5s")), 5e3));
  const work = (async () => {
    try {
      const db = require("./system/database");
      if (db) {
        if (typeof db.flush === "function") await db.flush(); else if (typeof db.flushSync === "function") db.flushSync(); else if (typeof db.write === "function" && db.getRaw) {
          const data = db.getRaw();
          if (data) await db.write(data);
        }
      }
      if (global.db && typeof global.db.write === "function" && global.db.data) {
        try {
          await global.db.write();
        } catch {}
      }
    } catch (e) {
      console.error("[main] flush error:", e.message);
    }
  })();
  try {
    await Promise.race([ work, timeout ]);
  } catch (e) {
    console.error("[main] flush race:", e.message);
  } finally {
    try {
      await fs.promises.rm(path.join(__dirname, "tmp"), {
        recursive: true,
        force: true
      });
    } catch {}
    process.exit(code);
  }
}

if (!global._mainSignalBound) {
  global._mainSignalBound = true;
  process.on("SIGTERM", () => flushDatabaseAndExit(0, "SIGTERM"));
  process.on("SIGINT", () => flushDatabaseAndExit(0, "SIGINT"));
  process.on("uncaughtException", err => {});
}

process.on("beforeExit", async () => {
  await fs.promises.rm(path.join(__dirname, "tmp"), {
    recursive: true,
    force: true
  }).catch(() => {});
});