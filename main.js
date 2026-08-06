const path = require("path");
const fs = require("fs");
const chalk = require("chalk");

const logErrorPath = path.join(__dirname, "system", "logerror.txt");
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

function isBaileysInternalError(err) {
  if (!err) return false;
  const stack = err.stack || "";
  const isBaileys = BAILEYS_MARKERS.some(m => stack.includes(m));
  if (!isBaileys) return false;
  const msg = err.message || "";
  return IGNORED_ERRORS.some(e => msg.includes(e) || stack.includes(e));
}

function logError(source, err) {
  if (isBaileysInternalError(err)) return;
  try {
    const ts = new Date().toISOString();
    const msg = err instanceof Error ? (err.stack || err.message || String(err)) : String(err);
    const entry = `[${ts}] [${source}] ${msg}\n`;
    fs.appendFileSync(logErrorPath, entry);
  } catch {}
  console.error(`[${source}]`, err instanceof Error ? err.message : err);
}

global.logError = logError;

const _origConsoleError = console.error.bind(console);
console.error = function (...args) {
  const firstArg = args[0];
  if (typeof firstArg === "string" && IGNORED_ERRORS.some(e => firstArg.includes(e))) return;
  if (firstArg instanceof Error && isBaileysInternalError(firstArg)) return;
  try {
    const ts = new Date().toISOString();
    const msg = args.map(a => (a instanceof Error ? (a.stack || a.message || String(a)) : typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    const entry = `[${ts}] [CONSOLE_ERROR] ${msg}\n`;
    fs.appendFileSync(logErrorPath, entry);
  } catch {}
  _origConsoleError(...args);
};

process.on("uncaughtException", (err) => {
  if (isBaileysInternalError(err)) return;
  logError("UNCAUGHT", err);
});

process.on("unhandledRejection", (err) => {
  if (isBaileysInternalError(err)) return;
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
  console.log("    1. Configure settings.js with your tokens");
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
  console.log("    Errors are saved to: system/logerror.txt");
  console.log(line);
}

if (hasFlag("help") || flags.length === 0) {
  showHelp();
  process.exit(0);
}

const startWA = hasFlag("whatsapp") || hasFlag("all");
const startDC = hasFlag("discord") || hasFlag("all");
const startTG = hasFlag("telegram") || hasFlag("all");

if (startWA) require("./system/bot/whatsapp/lib/start")();
if (startDC) require("./system/bot/discord/start")();
if (startTG) require("./system/bot/telegram/start")();

process.on("beforeExit", async () => {
  await fs.promises.rm(path.join(__dirname, "tmp"), { recursive: true, force: true }).catch(() => {});
});
