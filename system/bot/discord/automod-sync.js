import database from "../../database/index.js";

const INVITE_PATTERNS = ["*discord.gg/*", "*discord.com/invite/*", "*discordapp.com/invite/*"];

const RULE_DEFS = [
  { key: "keyword", name: "Akano Keyword", triggerType: 1 },
  { key: "spam", name: "Akano Spam", triggerType: 3 },
  { key: "mentions", name: "Akano Mentions", triggerType: 5 },
  { key: "preset", name: "Akano Profanity", triggerType: 4 }
];

function nativeOf(db, gid) {
  const srv = db.discord && db.discord.servers && db.discord.servers[String(gid)];
  if (!srv) return null;
  if (!srv.settings || typeof srv.settings !== "object") srv.settings = {};
  const st = srv.settings;
  if (!st.automod || typeof st.automod !== "object") return null;
  if (!st.automod.native || typeof st.automod.native !== "object") st.automod.native = { on: false };
  return st.automod;
}

function botPerms(guild) {
  try {
    const me = guild.members && guild.members.me;
    if (!me) return null;
    return me.permissions;
  } catch (e) {
    return null;
  }
}

function buildActions(a, db, gid) {
  const acts = [{ type: 1, metadata: { custom_message: "Blocked by Akano AutoMod" } }];
  if (a.log) acts.push({ type: 2, metadata: { channel_id: String(a.log) } });
  if (a.action === "timeout") {
    const mins = Math.max(1, Math.min(1440, a.timeoutMin || 10));
    acts.push({ type: 3, metadata: { duration_seconds: mins * 60 } });
  }
  return acts;
}

function buildRule(key, words, a) {
  const base = { name: "Akano " + key[0].toUpperCase() + key.slice(1), eventType: 1, enabled: true };
  if (key === "keyword") {
    const list = words.map(w => String(w).slice(0, 60)).filter(Boolean).slice(0, 990).concat(INVITE_PATTERNS);
    base.triggerType = 1;
    base.triggerMetadata = { keyword_filter: list.length ? list : ["akano-never-match-zzz"] };
  } else if (key === "spam") {
    base.triggerType = 3;
    base.triggerMetadata = {};
  } else if (key === "mentions") {
    base.triggerType = 5;
    base.triggerMetadata = { mention_total_limit: 5, mention_raid_protection_enabled: true };
  } else {
    base.triggerType = 4;
    base.triggerMetadata = { presets: [1, 2, 3] };
  }
  return base;
}

async function syncGuild(guild) {
  const db = database.get();
  const gid = String(guild.id);
  const a = nativeOf(db, gid) || { words: [], action: "delete", timeoutMin: 10, log: "", exempt: [] };
  const cfg = db.discord.servers[gid].settings.automod;
  const perms = botPerms(guild);
  if (!perms || !perms.has(32n)) throw new Error("Bot needs Manage Server permission in this server.");
  const nat = cfg.native;
  const words = Array.isArray(cfg.words) ? cfg.words : [];
  const exemptRoles = Array.isArray(cfg.exempt) ? cfg.exempt.slice(0, 20) : [];
  const canTimeout = (() => { try { return perms.has(1048576n); } catch (e) { return false; } })();
  const actions = buildActions({ action: cfg.action, timeoutMin: cfg.timeoutMin, log: cfg.log }, db, gid).filter(x => x.type !== 3 || canTimeout);
  const manager = guild.autoModerationRules;
  if (!manager) throw new Error("AutoMod API not available.");
  const done = {};
  for (const def of RULE_DEFS) {
    const spec = buildRule(def.key, words, cfg);
    let id = nat[def.key];
    let rule = null;
    if (id) {
      try { rule = await manager.fetch(id); } catch (e) { rule = null; }
    }
    if (!rule) {
      try {
        rule = await manager.create({
          name: spec.name,
          eventType: spec.eventType,
          triggerType: spec.triggerType,
          triggerMetadata: spec.triggerMetadata,
          actions: actions,
          enabled: true,
          exemptRoles: exemptRoles,
          reason: "Akano native sync"
        });
      } catch (e) {
        throw new Error(def.name + ": " + String((e && e.message) || e).slice(0, 120));
      }
    } else {
      try {
        rule = await rule.edit({
          triggerMetadata: spec.triggerMetadata,
          actions: actions,
          enabled: true,
          exemptRoles: exemptRoles,
          reason: "Akano native sync"
        });
      } catch (e) {
        throw new Error(def.name + ": " + String((e && e.message) || e).slice(0, 120));
      }
    }
    done[def.key] = rule.id;
  }
  nat.keyword = done.keyword;
  nat.spam = done.spam;
  nat.mentions = done.mentions;
  nat.preset = done.preset;
  nat.on = true;
  nat.syncedAt = Date.now();
  await database.write(db).catch(() => {});
  return done;
}

async function disableGuild(guild) {
  const db = database.get();
  const nat = nativeOf(db, String(guild.id));
  if (!nat) return 0;
  let n = 0;
  try {
    const manager = guild.autoModerationRules;
    for (const def of RULE_DEFS) {
      const id = nat[def.key];
      if (!id) continue;
      try {
        const rule = await manager.fetch(id).catch(() => null);
        if (rule) await rule.delete("Akano native off").catch(() => {});
        n++;
      } catch (e) {}
      delete nat[def.key];
    }
  } catch (e) {}
  nat.on = false;
  await database.write(db).catch(() => {});
  return n;
}

async function badgeProgress() {
  let total = 0;
  const per = [];
  try {
    const client = global.discordBot && global.discordBot.client;
    if (!client) return { total: 0, per: [] };
    for (const [, guild] of client.guilds.cache) {
      try {
        const perms = botPerms(guild);
        if (!perms || !perms.has(32n)) continue;
        if (!guild.autoModerationRules) continue;
        const rules = await guild.autoModerationRules.fetch().catch(() => null);
        if (!rules) continue;
        let c = 0;
        rules.forEach(r => { if (r && r.name && String(r.name).startsWith("Akano ")) c++; });
        if (c) per.push({ guild: guild.name, count: c });
        total += c;
      } catch (e) {}
    }
  } catch (e) {}
  return { total: total, per: per };
}

export {
  syncGuild,
  disableGuild,
  badgeProgress,
  nativeOf,
  RULE_DEFS
};
