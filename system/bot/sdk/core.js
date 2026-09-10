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

const _style = {
  wa: {
    bold: s => "*" + s + "*",
    italic: s => "_" + s + "_",
    mono: s => "`" + s + "`",
    strike: s => "~" + s + "~",
    underline: s => "__" + s + "__",
    quote: s => "> " + s,
    code: s => "```\n" + s + "\n```"
  },
  tg: {
    bold: s => "<b>" + s + "</b>",
    italic: s => "<i>" + s + "</i>",
    mono: s => "<code>" + s + "</code>",
    strike: s => "<s>" + s + "</s>",
    underline: s => "<u>" + s + "</u>",
    quote: s => "<blockquote>" + s + "</blockquote>",
    code: s => "<pre>" + s + "</pre>"
  },
  dc: {
    bold: s => "**" + s + "**",
    italic: s => "*" + s + "*",
    mono: s => "`" + s + "`",
    strike: s => "~~" + s + "~~",
    underline: s => "__" + s + "__",
    quote: s => "> " + s,
    code: s => "```\n" + s + "\n```",
    spoiler: s => "||" + s + "||"
  }
};

function styled(platform, style, text) {
  const p = _style[platform] || _style.wa;
  const fn = p[style] || (s => String(s));
  return fn(String(text == null ? "" : text));
}

function mksty(style) {
  const f = s => styled("wa", style, s);
  f.wa = s => styled("wa", style, s);
  f.tg = s => styled("tg", style, s);
  f.dc = s => styled("dc", style, s);
  return f;
}

const bold = mksty("bold");
const italic = mksty("italic");
const mono = mksty("mono");
const strike = mksty("strike");
const underline = mksty("underline");
const quote = mksty("quote");
const code = mksty("code");

function spaced(title) {
  return String(title || "").split("").join(" ");
}

function esc(text) {
  return String(text == null ? "" : text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function userCard(platform, d = {}) {
  const B = s => styled(platform, "bold", s);
  const E = platform === "tg" ? esc : (s => s);
  const mark = v => v ? "√" : "×";
  const row = (k, v) => "\t◦  " + B(k) + " : " + (v == null || v === "" ? "-" : E(v));
  const L = [];
  L.push("乂  " + B(spaced("USER-PROFILE")));
  L.push("");
  if (d.name !== undefined) L.push(row("Name", d.name));
  if (d.id !== undefined) L.push(row("ID", d.id));
  if (d.username !== undefined) L.push(row("Username", d.username));
  if (d.limit !== undefined) L.push(row("Limit", d.limit));
  if (d.hit !== undefined) L.push(row("Hitstat", d.hit));
  if (d.exp !== undefined) L.push(row("Exp", d.exp));
  if (d.money !== undefined) L.push(row("Money", d.money));
  if (d.warning !== undefined) L.push(row("Warning", d.warning));
  if (d.accountCreated !== undefined) L.push(row("Created", d.accountCreated));
  if (d.joined !== undefined) L.push(row("Joined", d.joined));
  if (d.lastseen !== undefined) L.push(row("Last Seen", d.lastseen));
  L.push("");
  L.push("乂  " + B(spaced("USER-STATUS")));
  L.push("");
  if (d.blocked !== undefined) L.push(row("Blocked", mark(d.blocked)));
  if (d.banned !== undefined) L.push(row("Banned", typeof d.banned === "string" ? d.banned : mark(d.banned)));
  if (d.bot !== undefined) L.push(row("Bot", mark(d.bot)));
  if (d.registered !== undefined) L.push(row("Registered", mark(d.registered)));
  if (d.usePrivate !== undefined) L.push(row("Use In Private", mark(d.usePrivate)));
  if (d.premium !== undefined) L.push(row("Premium", mark(d.premium)));
  if (d.expired !== undefined) L.push(row("Expired", d.expired));
  if (d.footer) {
    L.push("");
    L.push(platform === "tg" ? esc(d.footer) : d.footer);
  }
  return L.join("\n");
}

function toTimeShort(ms) {
  const s = Math.floor(Number(ms) / 1e3);
  if (!isFinite(s) || s < 0) return "0s";
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function formatSize(size) {
  const n = Number(size);
  if (!n) return "";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(1)}${units[i]}`;
}

function isNumber(x) {
  if (typeof x === "number") return !isNaN(x);
  if (typeof x !== "string" || !x.trim()) return false;
  return !isNaN(Number(x));
}

function getRandom(list) {
  if (Array.isArray(list) || typeof list === "string") return list[Math.floor(Math.random() * list.length)];
  return Math.floor(Math.random() * Number(list));
}

function generateLink(text) {
  return String(text || "").match(/https?:\/\/[^\s]+/gi) || [];
}

function socmed(url) {
  return [/tiktok\.com/, /instagram\.com/, /facebook\.com/, /fb\.watch/, /twitter\.com/, /x\.com/, /youtube\.com/, /youtu\.be/, /pinterest\.com/, /pin\.it/, /mediafire\.com/].some(p => p.test(String(url || "")));
}

function parseMention(text = "", suffix = "@s.whatsapp.net") {
  if (!text || typeof text !== "string") return [];
  return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(v => v[1] + suffix);
}

function sizeLimit(size, maxMB) {
  const max = Number(maxMB);
  if (typeof size === "number" && isFinite(size)) {
    const mb = size / (1024 * 1024);
    return { oversize: mb > max, size: `${parseFloat(mb.toFixed(1))}MB`, bytes: size };
  }
  const upperStr = String(size ?? "").toUpperCase().trim();
  if (!upperStr) return { oversize: true };
  if (/G(B)?|T(B)?/.test(upperStr)) return { oversize: true };
  const num = parseFloat(upperStr.replace(/MB|M|KB|K|B/gi, "").trim());
  if (isNaN(num)) return { oversize: true };
  let mb = num;
  if (/K(B)?/.test(upperStr)) mb = num / 1024;
  else if (!/M(B)?/.test(upperStr)) mb = num / (1024 * 1024);
  return { oversize: mb > max, size: `${parseFloat(mb.toFixed(1))}MB`, bytes: Math.round(mb * 1024 * 1024) };
}

const TG_DOWNLOAD_MAX = 20971520;
const TG_UPLOAD_MAX = 52400000;
const TG_PHOTO_MAX = 10485760;
const TG_URL_PHOTO_MAX = 5242880;
const TG_CAPTION_MAX = 1024;
const TG_TEXT_MAX = 4096;
const TG_CALLBACK_MAX = 64;

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
  styled: styled,
  esc: esc,
  bold: bold,
  italic: italic,
  mono: mono,
  strike: strike,
  underline: underline,
  quote: quote,
  code: code,
  spaced: spaced,
  userCard: userCard,
  toTimeShort: toTimeShort,
  formatSize: formatSize,
  isNumber: isNumber,
  getRandom: getRandom,
  generateLink: generateLink,
  socmed: socmed,
  parseMention: parseMention,
  sizeLimit: sizeLimit,
  _status: _status,
  TG_DOWNLOAD_MAX: TG_DOWNLOAD_MAX,
  TG_UPLOAD_MAX: TG_UPLOAD_MAX,
  TG_PHOTO_MAX: TG_PHOTO_MAX,
  TG_URL_PHOTO_MAX: TG_URL_PHOTO_MAX,
  TG_CAPTION_MAX: TG_CAPTION_MAX,
  TG_TEXT_MAX: TG_TEXT_MAX,
  TG_CALLBACK_MAX: TG_CALLBACK_MAX
};