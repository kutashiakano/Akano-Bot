const os = require("os");
const { version } = require(process.cwd() + "/package.json");


const { define } = require("../../plugin");

module.exports = define({
  name: ["ping", "status"],
  category: "([info])[0] || general",
  help: "Check bot status, uptime, and system performance",
  run: async (ctx) => {
    
        const uptime = global.telegramBot.startTime ? Date.now() - global.telegramBot.startTime : 0;
        const uptimeHours = Math.floor(uptime / 3600000);
        const uptimeMinutes = Math.floor((uptime % 3600000) / 60000);
        const uptimeSeconds = Math.floor((uptime % 60000) / 1000);
    
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memPercent = ((usedMem / totalMem) * 100).toFixed(2);
    
        const cpuUsage = process.cpuUsage();
        const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1000000).toFixed(2);
    
        const statusText = `
     <b>Bot Status</b>
    
    <b>Bot Info:</b>
    • Status: ${global.telegramBot.isRunning ? " Running" : " Offline"}
    • Version: v${version}
    • Platform: ${process.platform}
    • Node.js: ${process.version}
    
    <b>Performance:</b>
    • Uptime: ${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s
    • CPU Usage: ${cpuPercent}%
    • RAM Usage: ${(usedMem / 1024 / 1024).toFixed(2)}MB / ${(totalMem / 1024 / 1024).toFixed(2)}MB (${memPercent}%)
    • Free Memory: ${(freeMem / 1024 / 1024).toFixed(2)}MB
    
    <b>System:</b>
    • OS: ${os.type()} ${os.release()}
    • Arch: ${os.arch()}
    • CPUs: ${os.cpus().length} cores
    • Hostname: ${os.hostname()}
    
    <b>Bot Services:</b>
    • Plugins Loaded: ${Object.keys(global.telegramPlugins).length}
    • Telegram: ${global.telegramBot.isRunning ? " Online" : " Offline"}
    `;
    
        await ctx.reply(statusText, { parse_mode: "HTML" });
  },
});
