process.on("uncaughtException", (err) => {
  console.error(chalk.redBright("[PARENT CRASH]"), err);
  process.exit(1);
});

const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const chalk = require("chalk");
const cfonts = require("cfonts");

function centerText(text) {
  const clean = text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
  const pad = Math.floor((process.stdout.columns - clean.length) / 2);
  return " ".repeat(Math.max(0, pad)) + text;
}

process.on("unhandledRejection", (err) => {
  console.log(
    centerText(chalk.red.bold(`UNHANDLED ERROR: ${err.stack || err}`)),
  );
});

function showBanner() {
  process.stdout.write("\x1Bc");

  cfonts.say("Akano Bot", {
    font: "tiny",
    align: "center",
    colors: ["yellow"],
    space: true,
  });

  [
    `${chalk.hex("#FFD700")("OS")}    : ${os.platform()} ${os.arch()}`,
    `${chalk.hex("#FFD700")("Memory")}: ${(os.totalmem() / 1024 ** 3).toFixed(1)}GB`,
    `${chalk.hex("#FFD700")("Node")}  : ${process.version}`,
    `${chalk.hex("#FFD700")("Uptime")}: ${(os.uptime() / 3600).toFixed(1)}h`,
  ].forEach((line) => console.log(centerText(line)));

  console.log(centerText(chalk.hex("#FFA500")("\n▶ Initializing system\n")));
}

function start() {
  const app = spawn(
    process.argv[0],
    [path.join(__dirname, "main.js"), ...process.argv.slice(2)],
    { stdio: ["inherit", "inherit", "inherit", "ipc"] },
  );

  app.on("error", (err) => {
    console.log(centerText(chalk.red.bold(`CHILD ERROR: ${err.message}`)));
  });

  app.on("message", (m) => {
    if (m === "reset") {
      console.log(centerText(chalk.yellow("▶ Received restart request")));
      app.kill();
      start();
    }
  });

  app.on("exit", (code, signal) => {
    const status = signal ? `SIGNAL: ${signal}` : `CODE: ${code}`;
    console.log(centerText(chalk.red(`CHILD PROCESS TERMINATED - ${status}`)));
  });
}

showBanner();
start();
