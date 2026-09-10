class Cooldown {
  constructor(ms = 5e3) {
    this.cooldowns = new Map;
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
    this.records = new Map;
    this.RESET_TIMER = opts.RESET_TIMER || 5e3;
    this.HOLD_TIMER = opts.HOLD_TIMER || 6e4;
    this.HOLD_THRESHOLD = opts.HOLD_THRESHOLD || 5;
    this.PERM_T = opts.PERM_T || 10;
    this.NOT_T = opts.NOT_T || 3;
    this.BAN_T = opts.BAN_T || 15;
  }
  detection(userId, opts = {}) {
    const now = Date.now();
    let record = this.records.get(userId);
    if (!record) {
      record = {
        hits: [],
        state: null,
        msg: ""
      };
      this.records.set(userId, record);
    }
    record.hits.push(now);
    record.hits = record.hits.filter(t => now - t <= this.RESET_TIMER);
    const count = record.hits.length;
    if (count >= this.BAN_T) {
      record.state = "BANNED";
      record.msg = "You are permanently banned for spamming.";
      return record;
    }
    if (count >= this.PERM_T) {
      record.state = "PERMANENT";
      record.msg = `Spam detected (${count}x). Permanently limited.`;
      return record;
    }
    if (count >= this.HOLD_THRESHOLD) {
      record.state = "HOLD";
      record.msg = `Slow down! ${count} commands in ${this.RESET_TIMER / 1e3}s.`;
      return record;
    }
    if (count >= this.NOT_T) {
      record.state = "NOTIFY";
      record.msg = `Warning: ${count} commands in ${this.RESET_TIMER / 1e3}s.`;
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

module.exports = {
  Cooldown: Cooldown,
  SpamDetection: SpamDetection
};