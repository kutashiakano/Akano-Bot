const path = require("path");
const fs = require("fs");
const chalk = require("chalk");

const logErrorPath = path.join(__dirname, "system", "database", "logerror.json");
const logOldPath = path.join(__dirname, "system", "database", "logerror.old.json");
const logDir = path.dirname(logErrorPath);
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
if (!fs.existsSync(logErrorPath)) fs.writeFileSync(logErrorPath, "");

const BAILEYS_MARKERS = ["/baileys/", "@whiskeysockets/baileys", "/baileys-caller/"];
const IGNORED_ERRORS = [
  "isZero", "toJSON", "writeToFile", "reading 'child'",
  "makeNoiseHandler", "Cannot read properties of undefined",
  "noise-handler", "socket.js", "Stream Errored",
  "Connection Closed", "Bad MAC", "Failed to decrypt",
  "SessionEntry", "Closing session",
];
const IGNORED_MESSAGES = [
  "Connection Closed",
  "Failed to request pairing code",
  "Closing session",
  "SessionEntry",
  "Expected token to be set",
  "getaddrinfo ENOTFOUND",
  "WebSocket Error",
  "ctx.chatAct is not a function",
  "Class constructor ModalBuilder",
  "Cannot find module '../../music/utils'",
];

const MAX_LOG_SIZE = 1024 * 1024;
const MAX_ENTRIES = 2000;

let errorCount = 0;

function toWib(iso) {
  try {
    return new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
  } catch {
    return new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
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
  const iso = new Date().toISOString();
  const message = err instanceof Error ? (err.message || String(err)) : String(err);
  const name = err instanceof Error ? err.name : (err && err.constructor ? err.constructor.name : "Error");
  let stack = err instanceof Error && err.stack ? err.stack.split("\n").map((l) => l.trim()).filter(Boolean) : [];
  if (stack[0] && message && stack[0].includes(message.slice(0, 40))) stack.shift();
  const mem = process.memoryUsage();
  return {
    id: errorCount,
    ts: iso,
    wib: toWib(iso),
    source: String(source || "unknown"),
    name,
    code: err && err.code ? String(err.code) : null,
    message,
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
      heapTotal: +(mem.heapTotal / 1024 / 1024).toFixed(1),
    },
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
  try {
    rotateIfNeeded();
    fs.appendFileSync(logErrorPath, JSON.stringify(buildEntry(source, err, extraArgs)) + "\n");
    trimLogFile();
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
  writeLogEntry(source, err);
  console.error(`[${source}]`, err instanceof Error ? err.message : err);
}

global.logError = logError;
global.getLogErrors = readLogErrors;
global.logErrorPath = logErrorPath;

const _origConsoleError = console.error.bind(console);
console.error = function (...args) {
  const firstArg = args[0];
  const joined = args.map(a => (a instanceof Error ? (a.message || a.stack || String(a)) : typeof a === "string" ? a : "")).join(" ");
  if (IGNORED_MESSAGES.some(m => joined.includes(m))) return;
  if (typeof firstArg === "string" && IGNORED_ERRORS.some(e => firstArg.includes(e))) return;
  if (typeof firstArg === "string" && (firstArg.includes("MaxListenersExceeded") || firstArg.includes("uncaughtException listeners") || firstArg.includes("unhandledRejection listeners"))) return;
  if (firstArg instanceof Error && (isBaileysInternalError(firstArg) || isIgnoredMessage(firstArg))) return;
  try {
    writeLogEntry("CONSOLE_ERROR", new Error(args.map(a => (a instanceof Error ? (a.stack || a.message || String(a)) : typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ")));
  } catch {}
  _origConsoleError(...args);
};

process.on("uncaughtException", (err) => {
  if (isBaileysInternalError(err) || isIgnoredMessage(err)) return;
  logError("UNCAUGHT", err);
});

process.on("unhandledRejection", (err) => {
  if (isBaileysInternalError(err) || isIgnoredMessage(err)) return;
  logError("UNHANDLED", err);
});

process.on("warning", (warn) => {
  const msg = warn?.message || String(warn);
  if (msg.includes("MaxListenersExceeded") || msg.includes("DEP0")) return;
  logError("WARNING", warn);
});

require("./settings");

const args = process.argv.slice(2);
const flags = args.filter(a => a.startsWith("--"));
const hasFlag = (name) => flags.includes(`--${name}`);

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
  console.log("    1. Export secrets in ~/.akano-env (DISCORD_TOKEN, TELEGRAM_TOKEN, AKANO_OWNER, AKANO_MEM_LIMIT_MB)");
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
const startTG = hasFlag("telegram") || hasFlag("all");
global.waExclusive = startWA && !startDC && !startTG;

require("./system/core/watchdog").memWatch();
require("./system/core/cleaner").start();

if (startWA) require("./system/bot/whatsapp/lib/start")();
if (startDC) require("./system/bot/discord/start")();
if (startTG) require("./system/bot/telegram/start")();

process.on("beforeExit", async () => {
  await fs.promises.rm(path.join(__dirname, "tmp"), { recursive: true, force: true }).catch(() => {});
});
