const _emoji = {
  owner: "👑",
  premium: "💎",
  group: "👥",
  admin: "🛡️",
  botadmin: "🤖",
  private: "🔒",
  banned: "⛔",
  limit: "⚠️",
  reg: "📝",
  nsfw: "🔞",
  cooldown: "",
  error: "❗",
  success: "✅",
  info: "ℹ️",
  warn: "🚩",
  done: "🚀"
};

const _status = {
  owner: "Only the owner can use this feature.",
  premium: "This feature is for premium users only.",
  group: "This feature can only be used in groups.",
  admin: "This feature is for group admins only.",
  botadmin: "I need to be an admin to use this feature.",
  private: "This feature can only be used in private chats.",
  banned: "You have been banned from using the bot.",
  limit: "You reached the daily limit. It resets at midnight.",
  reg: "You must register first to use this feature.",
  nsfw: "This feature is marked 18+.",
  cooldown: "Slow down! Wait a moment before using this feature again.",
  error: "Something went wrong, try again later."
};

function emoji(key) {
  return _emoji[key] || "";
}

function status(key, custom) {
  const text = custom || _status[key] || _status.error;
  return _emoji[key] ? _emoji[key] + " " + text : text;
}

function sec(title) {
  return "\n──── " + title + " ────\n";
}

function panel(title, lines, empty) {
  const body = list(lines, empty);
  return title ? sec(title) + body : body;
}

function texted(style, text) {
  const s = String(text == null ? "" : text);
  switch (style) {
   case "bold":
    return "*" + s + "*";

   case "italic":
    return "_" + s + "_";

   case "mono":
    return "`" + s + "`";

   case "strike":
    return "~" + s + "~";

   case "underline":
    return "__" + s + "__";

   case "quote":
    return "> " + s;

   case "code":
    return "```\n" + s + "\n```";

   default:
    return s;
  }
}

function jsonFmt(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function toTime(ms) {
  const s = Math.floor(ms / 1e3);
  const d = Math.floor(s / 86400);
  const h = Math.floor(s % 86400 / 3600);
  const m = Math.floor(s % 3600 / 60);
  const sec = s % 60;
  const parts = [];
  if (d) parts.push(d + " day" + (d > 1 ? "s" : ""));
  if (h) parts.push(h + " hour" + (h > 1 ? "s" : ""));
  if (m) parts.push(m + " minute" + (m > 1 ? "s" : ""));
  if (sec || !parts.length) parts.push(sec + " second" + (sec !== 1 ? "s" : ""));
  return parts.join(", ");
}

function list(items, empty) {
  if (!items || !items.length) return empty || "_Nothing here._";
  return items.map((v, i) => "`" + (i + 1) + ".` " + v).join("\n");
}

function matcher(input, commands) {
  const results = [];
  for (const cmd of commands) {
    const c = String(cmd);
    let accuracy = 0;
    if (input === c) {
      accuracy = 100;
    } else if (c.startsWith(input)) {
      accuracy = 80;
    } else if (c.includes(input)) {
      accuracy = 70;
    } else {
      const ic = input.split("");
      const cc = c.split("");
      let matches = 0;
      for (const ch of ic) {
        if (cc.includes(ch)) matches++;
      }
      accuracy = Math.round(matches / Math.max(ic.length, cc.length) * 60);
    }
    if (accuracy >= 60) results.push({
      string: c,
      accuracy: accuracy
    });
  }
  return results.sort((a, b) => b.accuracy - a.accuracy);
}

function pad(n, len = 2) {
  return String(n).padStart(len, "0");
}

function cap(text) {
  const s = String(text || "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function example(isPrefix, command, botname) {
  if (!isPrefix || !command) return "";
  return "Contoh: " + isPrefix + command + " " + botname;
}

function toDate(ms) {
  const n = Number(ms);
  if (!isFinite(n) || n <= 0) return "Just now";
  const elapsed = n > 1e11 ? Date.now() - n : n;
  if (elapsed <= 0) return "Just now";
  const s = Math.floor(elapsed / 1e3);
  const d = Math.floor(s / 86400);
  const h = Math.floor(s % 86400 / 3600);
  const m = Math.floor(s % 3600 / 60);
  const sec = s % 60;
  const parts = [];
  if (d) parts.push(d + " day" + (d > 1 ? "s" : ""));
  if (h) parts.push(h + " hour" + (h > 1 ? "s" : ""));
  if (m) parts.push(m + " minute" + (m > 1 ? "s" : ""));
  if (sec || !parts.length) parts.push(sec + " second" + (sec !== 1 ? "s" : ""));
  return parts.join(" ") + " ago";
}

function timeReverse(ms) {
  const n = Number(ms);
  if (!isFinite(n) || n <= 0) return "0 seconds";
  const s = Math.floor(n / 1e3);
  const d = Math.floor(s / 86400);
  const h = Math.floor(s % 86400 / 3600);
  const m = Math.floor(s % 3600 / 60);
  const sec = s % 60;
  const parts = [];
  if (d) parts.push(d + " day" + (d > 1 ? "s" : ""));
  if (h) parts.push(h + " hour" + (h > 1 ? "s" : ""));
  if (m) parts.push(m + " minute" + (m > 1 ? "s" : ""));
  if (sec) parts.push(sec + " second" + (sec !== 1 ? "s" : ""));
  return parts.join(" ");
}

function formatNumber(n) {
  const num = Number(n);
  if (n == null || isNaN(num)) return String(n == null ? "0" : n);
  try {
    return num.toLocaleString("id-ID");
  } catch {
    return new Intl.NumberFormat("id-ID").format(num);
  }
}

function isUrl(str) {
  return /https?:\/\/[^\s]+/i.test(String(str || ""));
}

function jsonFormat(err) {
  if (err instanceof Error) {
    return "Type: " + err.name + "\nMessage: " + err.message + "\nStack: " + err.stack;
  }
  return jsonFmt(err);
}

module.exports = {
  texted: texted,
  jsonFmt: jsonFmt,
  toTime: toTime,
  list: list,
  status: status,
  emoji: emoji,
  sec: sec,
  panel: panel,
  matcher: matcher,
  pad: pad,
  cap: cap,
  example: example,
  toDate: toDate,
  timeReverse: timeReverse,
  formatNumber: formatNumber,
  isUrl: isUrl,
  jsonFormat: jsonFormat,
  _status: _status
};