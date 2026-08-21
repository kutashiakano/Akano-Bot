process.on("uncaughtException", (err) => {
  console.error("[PARENT CRASH]", err);
  process.exit(1);
});

const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const chalk = require("chalk");
const cfonts = require("cfonts");

require("./settings");

const RST_WIN = 5 * 60 * 1000;
const MAX_RST = 5;
const RESTART_DELAY_MS = 3000;
const MAX_DELAY_MS = 60000;

var isRunning = false;
var iReset = false;
var restartCount = 0;
var lastRestartTime = Date.now();

function centerText(text) {
  const clean = text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
  const pad = Math.floor((process.stdout.columns - clean.length) / 2);
  return " ".repeat(Math.max(0, pad)) + text;
}

process.on("unhandledRejection", (err) => {
  const msg = err?.message || String(err);
  if (msg.includes("Stream Errored") || msg.includes("Connection Closed") || msg.includes("Bad MAC")) return;
  console.log(centerText(chalk.red.bold("UNHANDLED ERROR: " + (err.stack || err))));
});

function showBanner() {
  process.stdout.write("\x1Bc");
  cfonts.say(global.botname, {
    font: "tiny",
    align: "center",
    colors: ["yellow"],
    space: true,
  });
  [
    "OS    : " + os.platform() + " " + os.arch(),
    "Memory: " + (os.totalmem() / 1024 ** 3).toFixed(1) + "GB",
    "Node  : " + process.version,
    "Uptime: " + (os.uptime() / 3600).toFixed(1) + "h",
  ].forEach((line) => console.log(centerText(chalk.hex("#FFD700")(line))));
  console.log(centerText(chalk.hex("#FFA500")("\nInitializing system\n")));
}

function start(file) {
  if (isRunning) return;
  isRunning = true;

  const args = [path.join(__dirname, file || "main.js"), ...process.argv.slice(2)];

  const app = spawn(
    process.argv[0],
    args,
    { stdio: ["inherit", "inherit", "inherit", "ipc"] },
  );

  app.on("error", (err) => {
    console.log(centerText(chalk.red.bold("CHILD ERROR: " + err.message)));
  });

  app.on("message", (m) => {
    if (m === "reset") {
      iReset = true;
      console.log(centerText(chalk.yellow("Restart request received")));
      app.kill();
      isRunning = false;
      start(file);
    }
  });

  app.on("exit", (code, signal) => {
    isRunning = false;
    const status = signal ? "SIGNAL: " + signal : "CODE: " + code;
    console.log(centerText(chalk.red("CHILD TERMINATED - " + status)));
    try {
      require("fs").appendFileSync(
        process.env.HOME + "/.akano-exit.log",
        JSON.stringify({
          ts: new Date().toISOString(),
          code,
          signal: signal || null,
          uptimeSec: Math.round(process.uptime()),
        }) + "\n"
      );
    } catch {}

    if (iReset) {
      iReset = false;
      return;
    }

    if (code === 0 && !signal) return;

    const now = Date.now();
    if (now - lastRestartTime > RST_WIN) restartCount = 0;
    restartCount++;
    lastRestartTime = now;

    if (restartCount > MAX_RST) {
      const delay = Math.min(MAX_DELAY_MS, restartCount * 5000);
      console.error(chalk.yellow(`Too many restarts (${restartCount}x). Waiting ${delay / 1000}s...`));
      setTimeout(() => start(file), delay);
      return;
    }

    const delay = Math.min(RESTART_DELAY_MS * Math.pow(2, restartCount - 1), MAX_DELAY_MS);
    console.log(chalk.yellow(`Restarting in ${delay / 1000}s... (attempt ${restartCount}/${MAX_RST})`));
    setTimeout(() => start(file), delay);
  });
}

showBanner();
start("main.js");
