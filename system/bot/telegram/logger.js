const fs = require("fs");
const path = require("path");
const chalk = require("chalk");

const logDir = path.join(process.cwd(), ".telelogs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logFile = path.join(logDir, "telegram.log");

function writeLog(level, message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(logFile, `[${timestamp}] [${level.toUpperCase()}] ${message}\n`);
}

const logger = {
  info(msg) {
    writeLog("info", msg);
    console.log(chalk.cyan("[TG]") + " " + chalk.white(msg));
  },
  warn(msg) {
    writeLog("warn", msg);
    console.log(chalk.yellow("[TG WARN]") + " " + chalk.yellow(msg));
  },
  error(msg, err) {
    const detail = err ? ` - ${err.message || err}` : "";
    const fullMsg = `${msg}${detail}`;
    writeLog("error", fullMsg);
    console.log(chalk.red("[TG ERR]") + " " + chalk.red(fullMsg));
  },
  cmd(ctx, command, args) {
    const user = ctx.from;
    const fullMsg = `${user?.username || user?.first_name || "Unknown"} ran /${command}${args ? " " + args : ""}`;
    writeLog("command", fullMsg);
  },
};

module.exports = logger;
