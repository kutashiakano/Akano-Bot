const fs = require("fs");
const path = require("path");

class Cooldown {
  constructor(ms = 5000) {
    this.cooldowns = new Map();
    this.ms = ms;
  }

  get(userId, command) {
    const key = `${userId}:${command}`;
    const cd = this.cooldowns.get(key);
    if (!cd) return 0;
    const remaining = cd - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  set(userId, command, ms) {
    const key = `${userId}:${command}`;
    this.cooldowns.set(key, Date.now() + (ms || this.ms));
  }

  has(userId, command) {
    return this.get(userId, command) > 0;
  }
}

class SpamDetection {
  constructor(opts = {}) {
    this.records = new Map();
    this.RESET_TIMER = opts.RESET_TIMER || 5000;
    this.HOLD_TIMER = opts.HOLD_TIMER || 60000;
    this.HOLD_THRESHOLD = opts.HOLD_THRESHOLD || 5;
    this.PERMANENT_THRESHOLD = opts.PERMANENT_THRESHOLD || 10;
    this.NOTIFY_THRESHOLD = opts.NOTIFY_THRESHOLD || 3;
    this.BANNED_THRESHOLD = opts.BANNED_THRESHOLD || 15;
  }

  detection(userId, opts = {}) {
    const now = Date.now();
    let record = this.records.get(userId);
    if (!record) {
      record = { hits: [], state: null, msg: "" };
      this.records.set(userId, record);
    }
    record.hits.push(now);
    record.hits = record.hits.filter(t => now - t <= this.RESET_TIMER);
    const count = record.hits.length;
    if (count >= this.BANNED_THRESHOLD) {
      record.state = "BANNED";
      record.msg = "You are permanently banned for spamming.";
      return record;
    }
    if (count >= this.PERMANENT_THRESHOLD) {
      record.state = "BANNED";
      record.msg = `Spam detected (${count}x). Banned.`;
      return record;
    }
    if (count >= this.HOLD_THRESHOLD) {
      record.state = "HOLD";
      record.msg = `Slow down! ${count} commands in ${this.RESET_TIMER / 1000}s.`;
      return record;
    }
    if (count >= this.NOTIFY_THRESHOLD) {
      record.state = "NOTIFY";
      record.msg = `Warning: ${count} commands in ${this.RESET_TIMER / 1000}s.`;
      return record;
    }
    record.state = "OK";
    record.msg = "";
    return record;
  }

  isBanned(userId) {
    const record = this.records.get(userId);
    return record && record.state === "BANNED";
  }

  clear(userId) {
    this.records.delete(userId);
  }
}

function matcher(input, commands) {
  const results = [];
  for (const cmd of commands) {
    let accuracy = 0;
    if (input === cmd) {
      accuracy = 100;
    } else if (cmd.startsWith(input)) {
      accuracy = 80;
    } else if (cmd.includes(input)) {
      accuracy = 70;
    } else {
      const inputChars = input.split("");
      const cmdChars = cmd.split("");
      let matches = 0;
      for (const c of inputChars) {
        if (cmdChars.includes(c)) matches++;
      }
      accuracy = Math.round((matches / Math.max(inputChars.length, cmdChars.length)) * 60);
    }
    if (accuracy >= 60) {
      results.push({ string: cmd, accuracy });
    }
  }
  return results.sort((a, b) => b.accuracy - a.accuracy);
}

function texted(style, text) {
  const styles = {
    bold: (t) => `*${t}*`,
    italic: (t) => `_${t}_`,
    strikethrough: (t) => `~${t}~`,
    monospace: (t) => "`" + t + "`",
  };
  return styles[style] ? styles[style](text) : text;
}

function toTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function generateLink(text) {
  const urlRegex = /https?:\/\/[^\s]+/gi;
  return (text || "").match(urlRegex) || [];
}

function socmed(url) {
  const patterns = [
    /tiktok\.com/,
    /instagram\.com/,
    /facebook\.com/,
    /fb\.watch/,
    /twitter\.com/,
    /x\.com/,
    /youtube\.com/,
    /youtu\.be/,
    /pinterest\.com/,
    /pin\.it/,
    /mediafire\.com/,
  ];
  return patterns.some(p => p.test(url));
}

module.exports = {
  Cooldown,
  SpamDetection,
  matcher,
  texted,
  toTime,
  generateLink,
  socmed,
};
