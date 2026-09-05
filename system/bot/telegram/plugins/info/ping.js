const os = require("os");

const HTML = {
  parse_mode: "HTML"
};

const {version: version} = require(process.cwd() + "/package.json");
const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "ping", "status" ],
  category: "info",
  help: "Check bot latency",
  run: async ctx => {
    const uptime = global.telegramBot.startTime ? Date.now() - global.telegramBot.startTime : 0;
    const uptimeHours = Math.floor(uptime / 36e5);
    const uptimeMinutes = Math.floor(uptime % 36e5 / 6e4);
    const uptimeSeconds = Math.floor(uptime % 6e4 / 1e3);
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = (usedMem / totalMem * 100).toFixed(2);
    const cpuUsage = process.cpuUsage();
    const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1e6).toFixed(2);
    const statusText = `\n     <b>Bot Status</b>\n    \n    <b>Bot Info:</b>\n    • Status: ${global.telegramBot.isRunning ? " Running" : " Offline"}\n    • Version: v${version}\n    • Platform: ${process.platform}\n    • Node.js: ${process.version}\n    \n    <b>Performance:</b>\n    • Uptime: ${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s\n    • CPU Usage: ${cpuPercent}%\n    • RAM Usage: ${(usedMem / 1024 / 1024).toFixed(2)}MB / ${(totalMem / 1024 / 1024).toFixed(2)}MB (${memPercent}%)\n    • Free Memory: ${(freeMem / 1024 / 1024).toFixed(2)}MB\n    \n    <b>System:</b>\n    • OS: ${os.type()} ${os.release()}\n    • Arch: ${os.arch()}\n    • CPUs: ${os.cpus().length} cores\n    • Hostname: ${os.hostname()}\n    \n    <b>Bot Services:</b>\n    • Plugins Loaded: ${Object.keys(global.telegramPlugins).length}\n    • Telegram: ${global.telegramBot.isRunning ? " Online" : " Offline"}\n    `;
    await ctx.reply(statusText, HTML);
  }
});