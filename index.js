process.on("uncaughtException", err => {
  console.error("[PARENT CRASH]", err);
  process.exit(1);
});

const {spawn: spawn} = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");
const chalk = require("chalk");
const cfonts = require("cfonts");

require("./settings");

const GC_FLAGS = [ "--expose-gc", "--max-old-space-size=512", "--optimize-for-size", "--gc-interval=50", "--max-semi-space-size=16" ];

const CHILD_EXEC_ARGV = GC_FLAGS.filter(flag => {
  const key = flag.split("=")[0];
  return !process.execArgv.includes(key);
});

const RST_WIN = 5 * 60 * 1e3;

const MAX_RST = 5;

const RESTART_DELAY_MS = 3e3;

const MAX_DELAY_MS = 6e4;

var isRunning = false;

var iReset = false;

var restartCount = 0;

var lastRestartTime = Date.now();

function centerText(text) {
  const clean = text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
  const pad = Math.floor((process.stdout.columns - clean.length) / 2);
  return " ".repeat(Math.max(0, pad)) + text;
}

process.on("unhandledRejection", err => {
  const msg = err?.message || String(err);
  if (msg.includes("Stream Errored") || msg.includes("Connection Closed") || msg.includes("Bad MAC")) return;
  console.log(centerText(chalk.red.bold("UNHANDLED ERROR: " + (err.stack || err))));
});

let _childApp = null;

let _shuttingDown = false;

function forwardSignal(sig) {
  if (_shuttingDown) return;
  _shuttingDown = true;
  console.log(centerText(chalk.yellow(`[PARENT] Received ${sig}, forwarding to child...`)));
  try {
    if (_childApp && !_childApp.killed) _childApp.kill(sig);
  } catch {}
  setTimeout(() => process.exit(0), 5e3).unref?.();
}

process.on("SIGTERM", () => forwardSignal("SIGTERM"));

process.on("SIGINT", () => forwardSignal("SIGINT"));

function showBanner() {
  process.stdout.write("c");
  cfonts.say(global.botname, {
    font: "tiny",
    align: "center",
    colors: [ "yellow" ],
    space: true
  });
  [ "OS    : " + os.platform() + " " + os.arch(), "Memory: " + (os.totalmem() / 1024 ** 3).toFixed(1) + "GB", "Node  : " + process.version + (global.gc ? " (GC exposed)" : " (no GC)"), "Uptime: " + (os.uptime() / 3600).toFixed(1) + "h" ].forEach(line => console.log(centerText(chalk.hex("#FFD700")(line))));
  if (!global.gc) {
    console.log(centerText(chalk.yellow("[hint] Run with --expose-gc for better memory control")));
  }
  console.log(centerText(chalk.hex("#FFA500")("\nInitializing system\n")));
}

function start(file) {
  if (isRunning) return;
  isRunning = true;
  const scriptPath = path.join(__dirname, file || "main.js");
  const args = [ scriptPath, ...process.argv.slice(2) ];
  const spawnArgs = [ ...CHILD_EXEC_ARGV, ...args ];
  const app = spawn(process.argv[0], spawnArgs, {
    stdio: [ "inherit", "inherit", "inherit", "ipc" ]
  });
  _childApp = app;
  let watchFallbackTimer = null;
  let restarted = false;
  try {
    fs.watchFile(scriptPath, {
      interval: 1e3
    }, (curr, prev) => {
      if (curr.mtimeMs !== prev.mtimeMs && !restarted) {
        restarted = true;
        console.log(centerText(chalk.yellow("[watchFile] main.js changed, scheduling restart...")));
        fs.unwatchFile(scriptPath);
        if (watchFallbackTimer) clearTimeout(watchFallbackTimer);
        watchFallbackTimer = setTimeout(() => {
          if (!isRunning) return;
          try {
            app.kill();
          } catch {}
        }, 3e3);
        watchFallbackTimer.unref?.();
      }
    });
  } catch {}
  app.on("error", err => {
    console.log(centerText(chalk.red.bold("CHILD ERROR: " + err.message)));
  });
  app.on("message", m => {
    if (m === "reset") {
      iReset = true;
      restarted = true;
      console.log(centerText(chalk.yellow("Restart request received (watchdog/child)")));
      try {
        fs.unwatchFile(scriptPath);
      } catch {}
      if (watchFallbackTimer) clearTimeout(watchFallbackTimer);
      try {
        app.kill();
      } catch {}
      isRunning = false;
      _childApp = null;
      start(file);
    }
  });
  app.on("exit", (code, signal) => {
    isRunning = false;
    _childApp = null;
    try {
      fs.unwatchFile(scriptPath);
    } catch {}
    if (watchFallbackTimer) clearTimeout(watchFallbackTimer);
    const status = signal ? "SIGNAL: " + signal : "CODE: " + code;
    console.log(centerText(chalk.red("CHILD TERMINATED - " + status)));
    try {
      require("fs").appendFileSync(process.env.HOME + "/.akano-exit.log", JSON.stringify({
        ts: (new Date).toISOString(),
        code: code,
        signal: signal || null,
        uptimeSec: Math.round(process.uptime())
      }) + "\n");
    } catch {}
    if (iReset) {
      iReset = false;
      return;
    }
    if (code === 0 && !signal) return;
    if (code === 1) {
      console.log(centerText(chalk.yellow("[watchdog] Memory exit (code 1) — immediate restart without backoff")));
      restartCount = 0;
      setTimeout(() => start(file), 1e3);
      return;
    }
    const now = Date.now();
    if (now - lastRestartTime > RST_WIN) restartCount = 0;
    restartCount++;
    lastRestartTime = now;
    if (restartCount > MAX_RST) {
      const delay = Math.min(MAX_DELAY_MS, restartCount * 5e3);
      console.error(chalk.yellow(`Too many restarts (${restartCount}x). Waiting ${delay / 1e3}s...`));
      setTimeout(() => start(file), delay);
      return;
    }
    const delay = Math.min(RESTART_DELAY_MS * Math.pow(2, restartCount - 1), MAX_DELAY_MS);
    console.log(chalk.yellow(`Restarting in ${delay / 1e3}s... (attempt ${restartCount}/${MAX_RST})`));
    setTimeout(() => start(file), delay);
  });
}

showBanner();

start("main.js");