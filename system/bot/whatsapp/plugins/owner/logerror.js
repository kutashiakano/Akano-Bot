const fs = require("fs");
const path = require("path");

const LOG_PATH = global.logErrorPath || path.join(process.cwd(), "system", "database", "logerror.json");

const PATTERNS = [
  {
    id: "native-binding",
    test: (e) =>
      /Cannot find native binding/i.test(e.message) ||
      /@snazzah\/davey/i.test(e.origin + (e.stack || []).join(" ")),
    cause:
      "Native dependency (npm optional dependency) failed to install or is corrupted, usually because package-lock.json and node_modules are out of sync.",
    fix: [
      "rm -rf node_modules package-lock.json",
      "npm i",
      "If it still fails: npm i @discordjs/voice --force",
    ],
  },
  {
    id: "enoent-rename",
    test: (e) => /ENOENT.*rename/i.test(e.message) || /rename.*database\.json/i.test(e.message),
    cause:
      "Multiple bot processes are writing to the same database, the .tmp file was removed before the rename finished.",
    fix: [
      "Kill all old bot processes: pkill -f 'node index.js'",
      "Make sure there is no duplicate process before restarting",
    ],
  },
  {
    id: "max-listeners",
    test: (e) => /MaxListenersExceeded|listeners added/i.test(e.message),
    cause:
      "Handler reload keeps adding uncaughtException/unhandledRejection listeners without removing them.",
    fix: [
      "Reduce handler reload frequency (WhatsApp lib/index.js)",
      "Safe to ignore temporarily, but consider adding process.setMaxListeners(20)",
    ],
  },
  {
    id: "timeout",
    test: (e) => /ETIMEDOUT|timeout|timed out/i.test(e.message),
    cause:
      "Network connection to a third-party server (TikTok/YT/etc.) is slow, blocked, or rate limited.",
    fix: ["Check internet connection and VPN/proxy", "Retry after a moment"],
  },
  {
    id: "instagram-login",
    test: (e) => /instagram.*login|login.*instagram/i.test(e.message),
    cause:
      "Instagram requires login (session expired / rate limited), scraping without a valid session.",
    fix: ["Update cookies.txt with a fresh session", "Reduce Instagram request frequency"],
  },
  {
    id: "file-too-large",
    test: (e) => /File too large|8MB/i.test(e.message),
    cause: "Downloaded file exceeds the Discord/WhatsApp upload limit.",
    fix: ["Use a smaller format or compress first", "Use a command that uploads via link"],
  },
  {
    id: "voice-channel",
    test: (e) => /Failed to connect to voice channel/i.test(e.message),
    cause:
      "Bot cannot join the voice channel: missing Connect/Speak permission or a broken existing connection.",
    fix: [
      "Check bot permissions: Connect & Speak in the voice channel",
      "Move the bot out of the voice channel and try again",
    ],
  },
  {
    id: "discord-voice-binding",
    test: (e) =>
      /@discordjs\/voice|@discordjs\/opus|play\/dca|prism-media/i.test(
        e.origin + (e.stack || []).join(" "),
      ),
    cause: "Discord voice library is broken (native binding / codec).",
    fix: [
      "rm -rf node_modules && npm i",
      "Make sure @discordjs/voice and @discordjs/opus are installed",
    ],
  },
  {
    id: "rate-limit",
    test: (e) => /429|rate.?limit|Too Many Requests/i.test(e.message),
    cause: "Too many requests in a short period to an API (Gemini/Instagram/etc.).",
    fix: ["Wait a few minutes", "Add delay between requests"],
  },
  {
    id: "auth",
    test: (e) => /401|403|unauthorized|forbidden/i.test(e.message),
    cause: "Token/API key is invalid or not permitted.",
    fix: ["Check API keys and tokens in settings.js", "Update cookies if needed"],
  },
  {
    id: "quota",
    test: (e) => /ENOSPC|no space|quota/i.test(e.message),
    cause: "Device storage is full.",
    fix: ["Clean temporary files in tmp/", "Free up device storage"],
  },
  {
    id: "missing-module",
    test: (e) => /Cannot find module/i.test(e.message),
    cause: "An npm module is not installed or was deleted.",
    fix: ["npm i", "If a specific module: npm i <module-name>"],
  },
  {
    id: "wa-not-connected",
    test: (e) => /Connection Closed|Failed to request pairing code|Closing session/i.test(e.message),
    cause: "WhatsApp not connected — pairing not requested or connection closed (expected when offline). Safe to ignore if you run --discord/--telegram only.",
    fix: ["Ignore if not using WhatsApp", "If WA needed: check pairing_number in settings and network"],
  },
  {
    id: "wa-pairing-ignore",
    test: (e) => /pairing code/i.test(e.message),
    cause: "Pairing code request failed (offline or WS not ready). Suppressed by logger.",
    fix: ["Ignore when WA offline", "Restart with --whatsapp when network ready"],
  },
];

function analyze(entry) {
  for (const p of PATTERNS) {
    if (p.test(entry)) return p;
  }
  return null;
}

function formatTime(entry) {
  return entry.wib || new Date(entry.ts).toLocaleString("en-US", { timeZone: "Asia/Jakarta" });
}

function truncate(s, n) {
  s = String(s || "");
  return s.length > n ? s.slice(0, n - 3) + "..." : s;
}

let handler = async (m, { sock, args }) => {
  const logs = global.getLogErrors ? global.getLogErrors(50) : [];
  const cmd = (args[0] || "").toLowerCase();

  if (cmd === "clear") {
    try {
      fs.writeFileSync(LOG_PATH, "");
    } catch {}
    return m.reply("Error log has been cleared.");
  }

  if (cmd === "file") {
    if (!fs.existsSync(LOG_PATH)) return m.reply("Log file does not exist yet.");
    return sock.sendMessage(m.chat, {
      document: fs.readFileSync(LOG_PATH),
      fileName: "logerror.json",
      mimetype: "application/json",
      caption: "Full error log (NDJSON)",
    });
  }

  if (cmd === "stats") {
    if (!logs.length) return m.reply("No errors recorded yet.");
    const bySource = {};
    for (const l of logs) bySource[l.source] = (bySource[l.source] || 0) + 1;
    const byName = {};
    for (const l of logs) {
      const n = l.name || "Unknown";
      byName[n] = (byName[n] || 0) + 1;
    }
    const topSrc = Object.entries(bySource)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topName = Object.entries(byName)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const lines = [
      "*ERROR LOG STATISTICS*",
      `Total errors (last 50): *${logs.length}*`,
      "",
      "*By Source:*",
      ...topSrc.map(([k, v]) => `> ${k}: ${v}x`),
      "",
      "*By Error Type:*",
      ...topName.map(([k, v]) => `> ${k}: ${v}x`),
    ];
    return m.reply(lines.join("\n"));
  }

  const num = parseInt(cmd, 10) || parseInt(args[0], 10);
  if (num && !isNaN(num)) {
    const entry = logs.find((l) => l.id === num) || logs[num - 1];
    if (!entry)
      return m.reply(`Error with ID ${num} was not found. Use *.logerror* to see the list.`);
    const insight = analyze(entry);
    const stack = (entry.stack || []).slice(0, 10);
    const lines = [
      `*ERROR DETAIL #${entry.id}*`,
      `Time   : ${formatTime(entry)}`,
      `Source : ${entry.source} | Type: ${entry.name}${entry.code ? ` | Code: ${entry.code}` : ""}`,
      "",
      `*Message:*`,
      truncate(entry.message, 400),
      `*Location:* ${entry.origin}`,
      "",
    ];
    if (stack.length) {
      lines.push(`*Stack (${stack.length}):*`);
      stack.forEach((s, i) => lines.push(`${i + 1}. ${truncate(s, 200)}`));
      lines.push("");
    }
    if (insight) {
      lines.push(`*Smart Analysis:* ${insight.cause}`);
      lines.push("");
      lines.push(`*Suggested Fix:*`);
      insight.fix.forEach((f, i) => lines.push(`${i + 1}. ${f}`));
    } else {
      lines.push("*Smart Analysis:* Unknown error pattern. Use `.logerror file` for full details.");
    }
    return m.reply(lines.join("\n"));
  }

  if (!logs.length)
    return m.reply("No errors recorded yet. Log is stored at *system/database/logerror.json*.");

  const lines = [`*ERROR LOG - LAST 5*`, `Total recorded: ${logs.length} errors`, ""];
  logs
    .slice(-5)
    .reverse()
    .forEach((l, i) => {
      lines.push(`*${i + 1}. #${l.id}* [${l.source}] ${formatTime(l)}`);
      lines.push(`   ${truncate(l.message, 120)}`);
      lines.push("");
    });
  lines.push(`Use *.logerror <id>* for details + smart analysis`);
  lines.push(`*.logerror stats* for statistics`);
  lines.push(`*.logerror file* to download the full log`);
  lines.push(`*.logerror clear* to clear`);
  return m.reply(lines.join("\n"));
};
const { define } = require("../../../plugin");

module.exports = define({
  name: ["logerror"],
  category: (["owner"])[0] || "tools",
  help: (["logerror"])[0] || "",
  owner: true,
  reg: true,
  run: function (c) { return handler.apply(c.that, [c.m, c.props]); },
});
