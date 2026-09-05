const os = require("os");
const fs = require("fs");
const path = require("path");
const {snapshot: snapshot, stats: stats, topCommandsList: topCommandsList, clearBuffers: clearBuffers} = require("./bus");
const {redactText: redactText} = require("./redact");

let features = null;

function getFeatures() {
  if (!features) features = require("./features");
  return features;
}

const store = require("./store");

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8"
  });
  res.end(body);
}

function botStatus() {
  const waSock = global.sock || null;
  const dcClient = global.discordBot && global.discordBot.client || null;
  const tgBot = global.telegramBot && global.telegramBot.bot || null;
  return {
    online: true,
    uptimeMs: Math.floor(process.uptime() * 1e3),
    startedAt: stats.startedAt,
    version: (() => {
      try {
        return require("../../../../../package.json").version;
      } catch {
        return "?";
      }
    })(),
    node: process.version,
    platform: `${os.platform()} ${os.arch()}`,
    pid: process.pid,
    memory: process.memoryUsage(),
    systemMemory: {
      total: os.totalmem(),
      free: os.freemem()
    },
    cpuLoad: os.loadavg(),
    whatsapp: (() => {
      if (!waSock) return {
        connected: false,
        state: "down",
        label: "Runtime off",
        user: null
      };
      if (waSock.user) {
        const num = String(waSock.user.id || "").split(":")[0].split("@")[0];
        let pretty = "+" + num;
        try {
          const PN = require("awesome-phonenumber");
          const pn = new PN("+" + num);
          if (pn.isValid()) pretty = pn.getNumber("international");
        } catch {}
        const name = waSock.user.name || waSock.user.verifiedName || "";
        return {
          connected: true,
          state: "linked",
          label: "Linked",
          user: name || pretty,
          phone: num,
          phonePretty: pretty
        };
      }
      const fsx = require("fs");
      const authDir = path.join(process.cwd(), String(global.settings && global.settings.sessions || "sessions"));
      let hasCreds = false;
      try {
        hasCreds = fsx.existsSync(path.join(authDir, "creds.json"));
      } catch {}
      return {
        connected: false,
        state: hasCreds ? "reconnecting" : "unpaired",
        label: hasCreds ? "Reconnecting" : "Awaiting link",
        user: null
      };
    })(),
    discord: dcClient ? {
      connected: dcClient.readyAt !== null,
      user: dcClient.user ? dcClient.user.tag : null,
      guilds: dcClient.guilds ? dcClient.guilds.cache.size : 0
    } : {
      connected: false
    },
    telegram: tgBot ? {
      connected: true
    } : {
      connected: false
    },
    maintenance: !!(global.settings && global.settings.maintenance),
    tunnel: (() => {
      try {
        const tunnel = require("./tunnel");
        return tunnel.getStatus();
      } catch {
        return {
          active: false
        };
      }
    })(),
    website: global.settings?.website || {}
  };
}

function applyOverlayToRuntime(overlay) {
  if (!overlay || typeof overlay !== "object") return;
  global.settings = global.settings || {};
  const s = overlay.settings || {};
  for (const [k, v] of Object.entries(s)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      global.settings[k] = Object.assign({}, global.settings[k], v);
    } else {
      global.settings[k] = v;
    }
  }
  if (typeof overlay.botname === "string" && overlay.botname.trim()) global.botname = overlay.botname.trim();
  if (typeof overlay.prefix === "string" && overlay.prefix.trim()) {
    try {
      global.prefix = overlay.prefix.split(",").map(p => p.trim()).filter(Boolean);
    } catch {}
  }
}

function syncDiscordPresence(presenceOverride) {
  try {
    const client = global.discordBot && global.discordBot.client || global.discord || null;
    if (!client || !client.user || typeof client.user.setPresence !== "function") return;
    if (typeof client.isReady === "function") {
      if (!client.isReady()) return;
    } else if (!client.readyAt) {
      return;
    }
    let ActivityType;
    try {
      ({ActivityType: ActivityType} = require("discord.js"));
    } catch {
      ActivityType = {
        Playing: 0,
        Streaming: 1,
        Listening: 2,
        Watching: 3,
        Custom: 4,
        Competing: 5
      };
    }
    if (!ActivityType) return;
    let dbPresence = {};
    try {
      dbPresence = require("../../../../database").get().settings?.discord?.presence || {};
    } catch {}
    const p = presenceOverride || global.settings && global.settings.discord && global.settings.discord.presence || {};
    const name = p.name || dbPresence.name || global.settings?.discord?.presence?.name || global.botname || "customstatus";
    const typeStr = p.type || dbPresence.type || global.settings?.discord?.presence?.type || "Custom";
    const type = ActivityType[typeStr] ?? ActivityType.Custom;
    const state = p.state || dbPresence.state || global.settings?.discord?.presence?.state || "Bot Active";
    const status = p.status || dbPresence.status || global.settings?.discord?.presence?.status || "online";
    client.user.setPresence({
      activities: [ {
        name: name,
        type: type,
        state: state
      } ],
      status: status
    });
  } catch (e) {
    try {
      if (global.logError) global.logError("dashboard.presence", e);
    } catch {}
  }
}

function collectGroups() {
  const out = [];
  try {
    const db = require("../../../../database").get();
    const groups = db.telegram && db.telegram.groups || {};
    for (const [id, g] of Object.entries(groups)) {
      out.push({
        platform: "telegram",
        id: String(id),
        name: g.title || id,
        members: g.members ? Object.keys(g.members).length : null,
        settings: {
          antispam: !!g.antispam,
          antiflood: !!g.antiflood,
          verification: !!g.verification
        }
      });
    }
  } catch {}
  try {
    const dc = global.discordBot && global.discordBot.client;
    if (dc) {
      for (const guild of dc.guilds.cache.values()) {
        out.push({
          platform: "discord",
          id: guild.id,
          name: guild.name,
          members: guild.memberCount,
          permissions: "Manage Server scope",
          channels: guild.channels ? guild.channels.cache.size : null
        });
      }
    }
  } catch {}
  try {
    const servers = require("../../../../database").get().discord?.servers || {};
    for (const [id, s] of Object.entries(servers)) {
      if (!out.find(o => o.platform === "discord" && o.id === id)) {
        out.push({
          platform: "discord",
          id: id,
          name: s.name || id,
          members: s.members ? Object.keys(s.members).length : null
        });
      }
    }
  } catch {}
  try {
    const chats = require("../../../../database").get().chats || {};
    for (const [jid, c] of Object.entries(chats)) {
      if (!String(jid).endsWith("@g.us")) continue;
      out.push({
        platform: "whatsapp",
        id: jid,
        name: jid.split("@")[0],
        members: Array.isArray(c.member) ? c.member.length : null,
        settings: {
          welcome: !!c.welcome,
          mute: !!c.mute,
          antiLink: !!c.antiLink
        }
      });
    }
  } catch {}
  return out;
}

function collectPlugins() {
  const db = (() => {
    try {
      return require("../../../../database").get();
    } catch {
      return {};
    }
  })();
  const disabled = db.settings && db.settings.disabledPlugins || {};
  const out = [];
  try {
    for (const [name, cmd] of Object.entries(global.discordCommands || {})) {
      out.push({
        platform: "discord",
        name: name,
        category: cmd.category || cmd.tags?.[0] || "tools",
        enabled: !(disabled.discord || []).includes(name),
        commands: Array.isArray(cmd.command) ? cmd.command : [ cmd.name ]
      });
    }
  } catch {}
  try {
    for (const [name, pl] of Object.entries(global.telegramPlugins || {})) {
      out.push({
        platform: "telegram",
        name: name,
        category: pl.tags && pl.tags[0] || "tools",
        enabled: !(disabled.telegram || []).includes(name),
        commands: Array.isArray(pl.command) ? pl.command : [ pl.command ].filter(Boolean)
      });
    }
  } catch {}
  try {
    let i = 0;
    for (const [file, pl] of Object.entries(global.plugin || {})) {
      if (i++ > 200) break;
      const names = Array.isArray(pl?.command) ? pl.command : [];
      out.push({
        platform: "whatsapp",
        name: path.basename(file),
        file: file,
        enabled: true,
        commands: names.slice(0, 6)
      });
    }
  } catch {}
  return out;
}

function collectSystem() {
  let pkg = {};
  let commit = null;
  try {
    pkg = require("../../../../../package.json");
  } catch {}
  try {
    commit = fs.readFileSync(path.join(process.cwd(), ".git", "HEAD"), "utf8").trim().split("/").pop() || null;
  } catch {}
  return {
    node: process.version,
    os: `${os.type()} ${os.release()}`,
    arch: os.arch(),
    cpuModel: os.cpus()[0]?.model || "unknown",
    cpus: os.cpus().length,
    totalMem: os.totalmem(),
    freeMem: os.freemem(),
    uptimeProcess: Math.floor(process.uptime() * 1e3),
    pid: process.pid,
    env: process.env.NODE_ENV || "production",
    version: pkg.version,
    deps: Object.keys(pkg.dependencies || {}).length,
    commit: commit
  };
}

const SCHEMA = require("../config/schema.json");

function getPath(obj, dotted) {
  return dotted.split(".").reduce((o, k) => o == null ? undefined : o[k], obj);
}

function settingsView() {
  const s = global.settings || {};
  const values = {};
  for (const key of Object.keys(SCHEMA.fields)) {
    let v = key === "botname" ? global.botname : key === "prefix" ? Array.isArray(global.prefix) ? global.prefix.join(",") : "" : getPath({
      settings: s
    }, key);
    if (v === undefined) {
      const defaults = {
        "settings.limit.enabled": true,
        "settings.limit.free": 15,
        "settings.limit.premium": 100,
        "settings.limit.reset": 24,
        "settings.discord.dailyLimit": 200,
        "settings.opts.autoRead": false,
        "settings.opts.selfMode": false,
        "settings.opts.dmOnly": false,
        "settings.opts.groupOnly": false,
        "settings.automation.autoTyping": true,
        "settings.telegram.autoTyping": true,
        "settings.telegram.inlineMode": true,
        "settings.telegram.webHook": false,
        "settings.telegram.greeting": "",
        "settings.telegram.groupManager.welcomeMessage": true,
        "settings.telegram.groupManager.goodbyeMessage": true,
        "settings.telegram.groupManager.autoGreeting": true,
        "settings.telegram.groupManager.verification": true,
        "settings.telegram.groupManager.moderation": true,
        "settings.connection.pairing_number": "",
        "settings.discord.presence.name": "customstatus",
        "settings.discord.presence.type": "Custom",
        "settings.discord.presence.state": "Bot Active",
        "settings.discord.presence.status": "online",
        "settings.group.welcome": true,
        "settings.group.antilink": true,
        "settings.log.error": true,
        "settings.website.enabled": true,
        "settings.website.mode": "local",
        "settings.website.port": 3001
      };
      v = defaults[key];
    }
    values[key] = v;
  }
  return {
    botname: global.botname || "",
    prefix: Array.isArray(global.prefix) ? global.prefix.join(",") : "",
    maintenance: !!s.maintenance,
    values: values
  };
}

function setPath(obj, dotted, value) {
  const parts = dotted.split(".");
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (typeof cur[parts[i]] !== "object" || cur[parts[i]] === null) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function validateAndBuildSave(body) {
  const overlay = store.getOverlay();
  const out = JSON.parse(JSON.stringify(overlay));
  const errors = [];
  if ("botname" in body) {
    const v = String(body.botname || "").trim();
    if (v.length > SCHEMA.fields.botname.max) errors.push("botname too long"); else out.botname = v;
  }
  if ("prefix" in body) {
    const v = String(body.prefix || "").trim();
    if (v.length > SCHEMA.fields.prefix.max) errors.push("prefix too long"); else out.prefix = v;
  }
  const incoming = body.values || {};
  for (const [key, raw] of Object.entries(incoming)) {
    const def = SCHEMA.fields[key];
    if (!def) {
      errors.push("unknown field: " + key);
      continue;
    }
    let v = raw;
    if (def.type === "boolean") v = v === true || v === "true"; else if (def.type === "number") {
      v = Number(v);
      if (!Number.isFinite(v)) {
        errors.push(key + " not a number");
        continue;
      }
    } else if (def.type === "string") v = String(v ?? "");
    if (def.type === "number" && def.min !== undefined && (v < def.min || v > def.max)) {
      errors.push(`${key} out of range ${def.min}-${def.max}`);
      continue;
    }
    if ((def.type === "string" || def.type === "enum") && def.max && String(v).length > def.max) {
      errors.push(key + " too long");
      continue;
    }
    if (def.type === "enum" && !def.options.includes(v)) {
      errors.push(key + " invalid option");
      continue;
    }
    if (key.startsWith("settings.")) setPath(out, key, v); else out[key] = v;
  }
  delete out.extraBots;
  delete out.bots;
  if (errors.length) throw new Error(errors.join("; "));
  return out;
}

const crypto2 = require("crypto");

function maskToken(t) {
  if (!t || typeof t !== "string" || t.length < 12) return t ? "set" : null;
  return "…" + t.slice(-6);
}

function waSessionInfo() {
  const authDir = path.join(process.cwd(), String(global.settings && global.settings.sessions || "sessions"));
  let creds = false, files = 0;
  try {
    creds = fs.existsSync(path.join(authDir, "creds.json"));
    files = fs.readdirSync(authDir).length;
  } catch {}
  return {
    authDir: authDir.replace(process.cwd() + "/", ""),
    creds: creds,
    files: files
  };
}

function botsView() {
  const st = botStatus();
  const s = global.settings || {};
  const wa = waSessionInfo();
  return {
    whatsapp: {
      label: "WhatsApp",
      state: st.whatsapp.state,
      statusLabel: st.whatsapp.label,
      user: st.whatsapp.user === "~" ? "" : st.whatsapp.user,
      phonePretty: st.whatsapp.phonePretty,
      phone: st.whatsapp.phonePretty || st.whatsapp.phone || null,
      sessionName: path.basename(String(s.sessions || "sessions")),
      sessionInfo: wa,
      pairingEnabled: !!global.sock,
      values: {
        "settings.opts.autoRead": getPath({
          settings: s
        }, "settings.opts.autoRead") ?? false,
        "settings.opts.selfMode": getPath({
          settings: s
        }, "settings.opts.selfMode") ?? false,
        "settings.opts.dmOnly": getPath({
          settings: s
        }, "settings.opts.dmOnly") ?? false,
        "settings.opts.groupOnly": getPath({
          settings: s
        }, "settings.opts.groupOnly") ?? false,
        "settings.automation.autoTyping": getPath({
          settings: s
        }, "settings.automation.autoTyping") ?? true
      }
    },
    telegram: {
      label: "Telegram",
      connected: st.telegram.connected,
      username: (global.telegramBot && global.telegramBot.bot && global.telegramBot.bot.botInfo ? global.telegramBot.bot.botInfo.username : null) || null,
      tokenMasked: maskToken(process.env.TELEGRAM_TOKEN || s.telegram?.token),
      hasToken: !!(process.env.TELEGRAM_TOKEN || s.telegram?.token),
      values: {
        "settings.telegram.autoTyping": getPath({
          settings: s
        }, "settings.telegram.autoTyping") ?? false,
        "settings.telegram.inlineMode": getPath({
          settings: s
        }, "settings.telegram.inlineMode") ?? true
      }
    },
    discord: {
      label: "Discord",
      connected: st.discord.connected,
      user: st.discord.user,
      guilds: st.discord.guilds,
      tokenMasked: maskToken(process.env.DISCORD_TOKEN || s.discord?.token),
      hasToken: !!(process.env.DISCORD_TOKEN || s.discord?.token),
      values: {
        "settings.discord.dailyLimit": getPath({
          settings: s
        }, "settings.discord.dailyLimit") ?? 200,
        "settings.discord.presence.name": getPath({
          settings: s
        }, "settings.discord.presence.name") ?? "customstatus",
        "settings.discord.presence.type": getPath({
          settings: s
        }, "settings.discord.presence.type") ?? "Custom",
        "settings.discord.presence.state": getPath({
          settings: s
        }, "settings.discord.presence.state") ?? "Bot Active",
        "settings.discord.presence.status": getPath({
          settings: s
        }, "settings.discord.presence.status") ?? "online"
      }
    }
  };
}

const AVATAR_CACHE = new Map;

const AVATAR_TTL = 10 * 60 * 1e3;

async function fetchBuf(url) {
  try {
    const ctrl = new AbortController;
    const t = setTimeout(() => ctrl.abort(), 6e3);
    const res = await fetch(url, {
      signal: ctrl.signal
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 500 ? buf : null;
  } catch {
    return null;
  }
}

async function liveAvatarUrl(platform) {
  try {
    if (platform === "discord") {
      const dc = global.discordBot && global.discordBot.client;
      if (dc && dc.user) return dc.user.displayAvatarURL({
        extension: "png",
        size: 128
      });
    }
    if (platform === "telegram") {
      const tgBotInstance = global.telegramBot;
      const tgBot = tgBotInstance?.bot;
      if (tgBot) {
        try {
          const me = await tgBot.api.getMe();
          if (me?.id && typeof tgBotInstance.getProfilePhotoUrl === "function") {
            const photoUrl = await tgBotInstance.getProfilePhotoUrl(me.id);
            if (photoUrl) return photoUrl;
          }
          const photos = await tgBot.api.getUserProfilePhotos(me.id, {
            limit: 1
          });
          const file_id = photos?.photos?.[0]?.[0]?.file_id;
          if (!file_id) return null;
          const file = await tgBot.api.getFile(file_id);
          if (!file?.file_path) return null;
          let token = global.settings?.telegram?.token || process.env.TELEGRAM_TOKEN || null;
          if (!token || token === "TELEGRAM_TOKEN_HERE") return null;
          return `https://api.telegram.org/file/bot${token}/${file.file_path}`;
        } catch {
          return null;
        }
      }
    }
    if (platform === "whatsapp") {
      const sock = global.sock;
      const jid = sock?.user?.id ? `${String(sock.user.id).split(":")[0]}@s.whatsapp.net` : null;
      if (jid && typeof sock.profilePictureUrl === "function") {
        return await sock.profilePictureUrl(jid, "image");
      }
    }
  } catch {}
  return null;
}

async function botAvatar(platform) {
  const cached = AVATAR_CACHE.get(platform);
  if (cached && Date.now() - cached.ts < AVATAR_TTL) return cached.buf;
  let buf = null;
  if (platform !== "owner") buf = await fetchBuf(await liveAvatarUrl(platform));
  if (!buf) {
    const canvasMod = require("../../../../scrapers/src/canvas.js");
    if (!canvasMod.available) return null;
    const size = 128;
    const cv = canvasMod.createCanvas(size, size);
    const g = cv.getContext("2d");
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = platform === "owner" ? "#1c1c22" : "#2a2a3d";
    g.fillRect(0, 0, size, size);
    g.strokeStyle = "white";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
    g.stroke();
    let letter = {
      whatsapp: "W",
      telegram: "T",
      discord: "D",
      owner: "A"
    }[platform] || "?";
    if (platform === "whatsapp") {
      const waSock = global.sock;
      if (waSock && waSock.user && waSock.user.name) letter = String(waSock.user.name).trim()[0].toUpperCase();
    } else if (platform === "discord") {
      const dc = global.discordBot && global.discordBot.client;
      if (dc && dc.user && dc.user.username) letter = String(dc.user.username).trim()[0].toUpperCase();
    } else if (platform === "telegram") {
      const tg = global.telegramBot && global.telegramBot.bot;
      const un = tg && tg.botInfo ? tg.botInfo.first_name || tg.botInfo.username : null;
      if (un) letter = String(un).trim()[0].toUpperCase();
    }
    g.fillStyle = "#EDEDED";
    g.font = "bold 62px Akano, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(letter, size / 2, size / 2 + 4);
    buf = cv.toBuffer("image/png");
  }
  AVATAR_CACHE.set(platform, {
    ts: Date.now(),
    buf: buf
  });
  return buf;
}

function musicNow() {
  const out = [];
  try {
    const playCmd = global.discordCommands && global.discordCommands.p;
    const queues = playCmd && typeof playCmd.getQueues === "function" ? playCmd.getQueues() : null;
    if (queues) {
      for (const [guildId, q] of queues.entries()) {
        if (!q.currentSong) continue;
        out.push({
          guildId: guildId,
          guild: q.textChannel ? q.textChannel.guild?.name || guildId : guildId,
          title: String(q.currentSong.title || "").slice(0, 90),
          artist: String(q.currentSong.uploader || q.currentSong.channel || "").slice(0, 60),
          thumbnail: q.currentSong.thumbnail || "",
          url: q.currentSong.url || "",
          elapsed: Math.floor((q.currentResource && q.currentResource.playbackDuration || 0) / 1e3),
          duration: q.currentSong.duration || 0,
          queued: Array.isArray(q.songs) ? q.songs.length : 0,
          volume: Math.round((q.volume || 1) * 100),
          paused: !!q.paused
        });
      }
    }
  } catch {}
  return out;
}

const DEV_ROOTS = {
  discord: "system/bot/discord/plugins",
  telegram: "system/bot/telegram/plugins",
  whatsapp: "system/bot/whatsapp/plugins",
  scrapers: "system/scrapers/src"
};

function safeDevPath(key, rel) {
  const root = DEV_ROOTS[key];
  if (!root) return null;
  const full = path.resolve(process.cwd(), root, String(rel || ""));
  if (!full.startsWith(path.resolve(process.cwd(), root) + path.sep)) return null;
  if (!full.endsWith(".js")) return null;
  return full;
}

function devList(key, sub) {
  const rootRel = DEV_ROOTS[key];
  if (!rootRel) return [];
  const base = path.resolve(process.cwd(), rootRel, String(sub || ""));
  if (!base.startsWith(path.resolve(process.cwd(), rootRel))) return [];
  const out = [];
  const walk = dir => {
    let entries = [];
    try {
      entries = fs.readdirSync(dir, {
        withFileTypes: true
      });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = path.relative(path.resolve(process.cwd(), rootRel), full).split(path.sep).join("/");
      if (e.isDirectory()) walk(full); else if (e.name.endsWith(".js")) {
        const st = fs.statSync(full);
        out.push({
          f: rel,
          size: st.size,
          mtime: st.mtimeMs
        });
      }
    }
  };
  walk(base);
  return out.slice(0, 400);
}

function collectChats() {
  const chats = [];
  try {
    const db = require("../../../../database").get();
    if (db.chats && Array.isArray(db.chats)) {
      for (const c of db.chats) {
        chats.push({
          platform: "whatsapp",
          id: c.id || c.jid,
          name: c.name || c.subject || c.id,
          isGroup: (c.id || "").endsWith("@g.us"),
          lastMessage: c.lastMessage || null,
          lastMessageTime: c.lastMessageTime || c.t || 0,
          unread: c.unread || 0,
          avatar: c.avatar || null
        });
      }
    }
  } catch {}
  try {
    const snap = snapshot();
    const tgChats = new Map;
    for (const m of snap.messages) {
      if (m.platform === "telegram" && m.chatId) {
        if (!tgChats.has(m.chatId)) {
          tgChats.set(m.chatId, {
            platform: "telegram",
            id: m.chatId,
            name: m.chatName || m.pushName || m.chatId,
            isGroup: m.isGroup || false,
            lastMessage: m.text || "",
            lastMessageTime: m.ts || 0,
            unread: 0,
            avatar: m.avatarUrl || null
          });
        } else {
          const existing = tgChats.get(m.chatId);
          if (m.ts > existing.lastMessageTime) {
            existing.lastMessage = m.text || "";
            existing.lastMessageTime = m.ts;
          }
        }
      }
    }
    chats.push(...tgChats.values());
  } catch {}
  try {
    const dcClient = global.discordBot && global.discordBot.client || null;
    if (dcClient && dcClient.channels) {
      const textChannels = dcClient.channels.cache.filter(c => c.type === 0 || c.type === 5);
      for (const [id, ch] of textChannels) {
        chats.push({
          platform: "discord",
          id: id,
          name: ch.name || id,
          isGroup: true,
          guildName: ch.guild?.name || "",
          lastMessage: null,
          lastMessageTime: 0,
          unread: 0,
          avatar: ch.guild?.iconURL?.() || null
        });
      }
    }
  } catch {}
  chats.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
  return chats;
}

function getChatMessages(platform, chatId, limit = 50) {
  const snap = snapshot();
  return snap.messages.filter(m => m.platform === platform && (m.chatId === chatId || m.from === chatId || m.to === chatId)).slice(-limit).reverse();
}

function getChatUser(platform, chatId) {
  const snap = snapshot();
  const msgs = snap.messages.filter(m => m.platform === platform && (m.from === chatId || m.chatId === chatId));
  const last = msgs[msgs.length - 1];
  return {
    id: chatId,
    platform: platform,
    name: last?.pushName || last?.chatName || chatId,
    avatar: last?.avatarUrl || null,
    lastSeen: last?.ts || null,
    messageCount: msgs.length
  };
}

async function sendChatMessage(platform, chatId, text) {
  if (platform === "whatsapp") {
    const sock = global.sock;
    if (!sock) throw new Error("WhatsApp not connected");
    await sock.sendMessage(chatId, {
      text: text
    });
  } else if (platform === "telegram") {
    const tgBot = global.telegramBot?.bot;
    if (!tgBot) throw new Error("Telegram not connected");
    await tgBot.api.sendMessage(chatId, text);
  } else if (platform === "discord") {
    const dcClient = global.discordBot && global.discordBot.client || null;
    if (!dcClient) throw new Error("Discord not connected");
    const channel = await dcClient.channels.fetch(chatId);
    if (!channel) throw new Error("Channel not found");
    await channel.send(text);
  } else {
    throw new Error("Unknown platform: " + platform);
  }
  try {
    const {pushMessage: pushMessage} = require("./bus");
    pushMessage({
      platform: platform,
      chatId: chatId,
      from: "bot",
      pushName: global.botname || "Akano",
      text: text,
      isGroup: platform === "whatsapp" ? chatId.endsWith("@g.us") : false,
      ts: Date.now(),
      outbound: true
    });
  } catch {}
  return {
    sent: true,
    platform: platform,
    chatId: chatId,
    text: text
  };
}

function handleApi(req, res, url, send) {
  const p = url.pathname;
  if (p === "/api/status") return send(res, 200, botStatus());
  if (p === "/api/music/now") return send(res, 200, musicNow());
  if (p === "/api/stats") {
    const snap = snapshot();
    return send(res, 200, {
      ...snap.stats,
      activeMessages: snap.messages.length,
      topCommands: topCommandsList(8)
    });
  }
  if (p === "/api/messages") {
    const snap = snapshot();
    const q = url.searchParams;
    const limit = Math.min(parseInt(q.get("limit") || "100", 10) || 100, snap.messages.length);
    return send(res, 200, snap.messages.slice(-limit).reverse());
  }
  if (p === "/api/logs") {
    const snap = snapshot();
    const q = url.searchParams;
    let items = [ ...snap.logs ];
    const level = q.get("level");
    const source = q.get("source");
    const search = (q.get("q") || "").toLowerCase();
    if (level) items = items.filter(l => l.level === level);
    if (source) items = items.filter(l => (l.source || "").includes(source));
    if (search) items = items.filter(l => JSON.stringify(l).toLowerCase().includes(search));
    return send(res, 200, items.reverse().slice(0, 300));
  }
  if (p === "/api/logs/file") {
    try {
      const file = path.join(process.cwd(), "system", "database", "logerror.json");
      const lines = fs.readFileSync(file, "utf8").split("\n").filter(Boolean);
      return send(res, 200, lines.slice(-300).reverse().map(l => {
        try {
          return JSON.parse(l);
        } catch {
          return {
            raw: l
          };
        }
      }));
    } catch {
      return send(res, 200, []);
    }
  }
  if (p === "/api/groups") return send(res, 200, collectGroups());
  if (p === "/api/plugins") return send(res, 200, collectPlugins());
  if (p === "/api/system") {
    const sys = collectSystem();
    delete sys.env;
    return send(res, 200, sys);
  }
  if (p === "/api/bots") return send(res, 200, botsView());
  if (p === "/api/chats") {
    const chats = collectChats();
    return send(res, 200, chats);
  }
  if (p === "/api/telegram/chats") {
    const chats = collectChats().filter(c => c.platform === "telegram");
    return send(res, 200, chats);
  }
  if (p.startsWith("/api/telegram/messages/")) {
    const chatId = decodeURIComponent(p.replace("/api/telegram/messages/", ""));
    const msgs = getChatMessages("telegram", chatId, parseInt(url.searchParams.get("limit") || "50", 10));
    return send(res, 200, msgs);
  }
  if (p.startsWith("/api/telegram/user/")) {
    const userId = decodeURIComponent(p.replace("/api/telegram/user/", ""));
    const user = getChatUser("telegram", userId);
    return send(res, 200, user);
  }
  if (p.startsWith("/api/chats/")) {
    const parts = p.split("/");
    const platform = parts[3];
    const chatId = decodeURIComponent(parts[4] || "");
    if (parts[5] === "messages") {
      const msgs = getChatMessages(platform, chatId, parseInt(url.searchParams.get("limit") || "50", 10));
      return send(res, 200, msgs);
    }
    if (parts[5] === "user") {
      const user = getChatUser(platform, chatId);
      return send(res, 200, user);
    }
  }
  if (p === "/api/dev/list") {
    const key = url.searchParams.get("key") || "";
    const sub = url.searchParams.get("sub") || "";
    if (!DEV_ROOTS[key]) return send(res, 400, {
      ok: false,
      message: "unknown key"
    });
    return send(res, 200, devList(key, sub));
  }
  if (p === "/api/dev/read") {
    const key = url.searchParams.get("key") || "";
    const full = safeDevPath(key, url.searchParams.get("f"));
    if (!full) return send(res, 400, {
      ok: false,
      message: "invalid path"
    });
    try {
      const stat = fs.statSync(full);
      return send(res, 200, {
        content: fs.readFileSync(full, "utf8"),
        mtime: stat.mtimeMs,
        size: stat.size
      });
    } catch {
      return send(res, 404, {
        ok: false,
        message: "file not found"
      });
    }
  }
  if (p === "/api/db/backup") return send(res, 200, {
    ok: true,
    file: getFeatures().createBackup()
  });
  if (p === "/api/db/backups") return send(res, 200, getFeatures().listDbBackups());
  if (p === "/api/db/integrity") return send(res, 200, getFeatures().checkIntegrity());
  if (p === "/api/db/restore") {
    try {
      getFeatures().restoreDb(body && body.file);
      return send(res, 200, {
        ok: true
      });
    } catch (e) {
      return send(res, 400, {
        ok: false,
        message: e.message
      });
    }
  }
  if (p === "/api/health") return send(res, 200, getFeatures().healthCheck());
  if (p === "/api/storage") return send(res, 200, getFeatures().getStorageStats());
  if (p === "/api/failed") return send(res, 200, getFeatures().getFailed());
  if (p === "/api/schedule") {
    if (req.method === "POST") {
      const h = body && body.hour;
      if (h === null || h === undefined) {
        getFeatures().clearSchedule();
        return send(res, 200, {
          ok: true,
          message: "Schedule cleared."
        });
      }
      getFeatures().setSchedule(parseInt(h, 10));
      return send(res, 200, {
        ok: true,
        message: `Restart scheduled at hour ${h}.`
      });
    }
    return send(res, 200, {
      hour: getFeatures().getSchedule()
    });
  }
  if (p === "/api/schema") return send(res, 200, SCHEMA);
  if (p === "/api/tunnel/status") {
    const tunnel = require("./tunnel");
    return send(res, 200, tunnel.getStatus());
  }
  if (p === "/api/settings") {
    const view = settingsView();
    view.overlay = store.getOverlay();
    return send(res, 200, view);
  }
  if (p === "/api/audit") return send(res, 200, store.readAudit(120));
  if (p === "/api/backups") return send(res, 200, store.listBackups());
  return null;
}

async function handleAction(req, res, url, body, send) {
  const p = url.pathname;
  if (p === "/api/bot/restart") {
    store.audit("bot.restart", "requested");
    if (typeof process.send === "function") {
      process.send("reset");
      return send(res, 200, {
        ok: true,
        message: "Restart requested via watchdog."
      });
    }
    setTimeout(() => process.exit(0), 300);
    return send(res, 200, {
      ok: true,
      message: "Exiting; supervisor should restart."
    });
  }
  if (p === "/api/settings/save") {
    try {
      const merged = validateAndBuildSave(body || {});
      store.saveOverlay(merged);
      applyOverlayToRuntime(store.getOverlay());
      if (merged.botname) global.botname = merged.botname;
      if (typeof merged.prefix === "string") {
        try {
          global.prefix = merged.prefix.split(",").map(x => x.trim()).filter(Boolean);
        } catch {}
      }
      try {
        const vals = body && body.values ? body.values : {};
        const hasPresenceChange = Object.keys(vals).some(k => k.startsWith("settings.discord.presence."));
        if (hasPresenceChange) {
          const presence = merged.settings && merged.settings.discord && merged.settings.discord.presence || global.settings && global.settings.discord && global.settings.discord.presence || {};
          try {
            const dcClient = global.discordBot && global.discordBot.client ? global.discordBot.client : null;
            if (dcClient && dcClient.user && typeof dcClient.user.setPresence === "function") {
              const isReady = typeof dcClient.isReady === "function" ? dcClient.isReady() : !!dcClient.readyAt;
              if (isReady) {
                let ActivityType;
                try {
                  ({ActivityType: ActivityType} = require("discord.js"));
                } catch {
                  ActivityType = {
                    Playing: 0,
                    Streaming: 1,
                    Listening: 2,
                    Watching: 3,
                    Custom: 4,
                    Competing: 5
                  };
                }
                const name = presence.name || global.settings?.discord?.presence?.name || global.botname || "customstatus";
                const type = ActivityType[presence.type || global.settings?.discord?.presence?.type || "Custom"] ?? ActivityType.Custom;
                const state = presence.state || global.settings?.discord?.presence?.state || "Bot Active";
                const status = presence.status || global.settings?.discord?.presence?.status || "online";
                global.discordBot.client.user.setPresence({
                  activities: [ {
                    name: name,
                    type: type,
                    state: state
                  } ],
                  status: status
                });
              }
            }
          } catch {}
        }
      } catch {}
      try {
        const bus = require("./bus");
        bus.emitSettingsUpdate(merged);
      } catch {}
      return send(res, 200, {
        ok: true,
        message: "Configuration saved and applied live."
      });
    } catch (e) {
      return send(res, 400, {
        ok: false,
        message: e.message
      });
    }
  }
  if (p === "/api/settings/reload") {
    applyOverlayToRuntime(store.getOverlay());
    try {
      const settingsPath = path.join(process.cwd(), "settings.js");
      delete require.cache[require.resolve(settingsPath)];
      require(settingsPath);
    } catch (e) {
      return send(res, 500, {
        ok: false,
        message: "Reload failed: " + e.message
      });
    }
    applyOverlayToRuntime(store.getOverlay());
    store.audit("settings.reload", "ok");
    try {
      const bus = require("./bus");
      bus.emitSettingsUpdate(store.getOverlay());
    } catch {}
    return send(res, 200, {
      ok: true,
      message: "Configuration reloaded."
    });
  }
  if (p === "/api/settings/restore") {
    try {
      const restored = store.restoreBackup(body && body.file);
      applyOverlayToRuntime(restored);
      return send(res, 200, {
        ok: true,
        message: "Restored from " + body.file
      });
    } catch (e) {
      return send(res, 400, {
        ok: false,
        message: e.message
      });
    }
  }
  if (p === "/api/plugins/reload") {
    const target = body && body.platform;
    let count = 0;
    try {
      if (target === "discord" || !target) {
        const instance = global.discordBot && global.discordBot.instance;
        if (instance && typeof instance.loadCommands === "function") {
          instance.loadCommands();
          count++;
        }
      }
      if ((target === "whatsapp" || !target) && typeof global.reloadHandler === "function") {
        count++;
      }
      store.audit("plugins.reload", target || "all");
    } catch (e) {
      return send(res, 500, {
        ok: false,
        message: e.message
      });
    }
    if (!count) return send(res, 501, {
      ok: false,
      message: "No reload hook available for this platform."
    });
    return send(res, 200, {
      ok: true,
      message: `Reload triggered (${count} platform${count > 1 ? "s" : ""}).`
    });
  }
  if (p === "/api/plugins/toggle") {
    try {
      const database = require("../../../../database");
      const db = database.get();
      const {platform: platform, name: name, enable: enable} = body || {};
      if (!platform || !name) throw new Error("platform and name required");
      if (![ "discord", "telegram" ].includes(platform)) throw new Error("unsupported platform for toggle");
      if (!db.settings.disabledPlugins) db.settings.disabledPlugins = {
        telegram: [],
        discord: []
      };
      const list = db.settings.disabledPlugins[platform];
      const idx = list.indexOf(name);
      if (enable && idx !== -1) list.splice(idx, 1);
      if (!enable && idx === -1) list.push(name);
      database.write(db);
      store.audit("plugin.toggle", enable ? "enable" : "disable", `${platform}:${name}`);
      return send(res, 200, {
        ok: true,
        message: `${name} ${enable ? "enabled" : "disabled"} (restart or reload to fully apply).`
      });
    } catch (e) {
      return send(res, 400, {
        ok: false,
        message: e.message
      });
    }
  }
  if (p === "/api/cache/clear") {
    try {
      const cleaner = require("../../../../core/cleaner");
      const freed = cleaner.clean ? cleaner.clean(0) : null;
      store.audit("cache.clear", "ok");
      return send(res, 200, {
        ok: true,
        message: "Temp cache cleared.",
        detail: typeof freed === "number" ? `${freed} files` : undefined
      });
    } catch (e) {
      return send(res, 500, {
        ok: false,
        message: e.message
      });
    }
  }
  if (p === "/api/maintenance") {
    const enable = !!(body && body.enable);
    global.settings = global.settings || {};
    global.settings.maintenance = enable;
    const overlay = store.getOverlay();
    overlay.settings = Object.assign({}, overlay.settings, {
      maintenance: enable
    });
    try {
      store.saveOverlay(overlay);
    } catch {}
    store.audit("maintenance", enable ? "on" : "off");
    return send(res, 200, {
      ok: true,
      message: `Maintenance ${enable ? "enabled" : "disabled"} (enforced on Discord & Telegram).`
    });
  }
  if (p === "/api/tunnel/status") {
    const tunnel = require("./tunnel");
    return send(res, 200, tunnel.getStatus());
  }
  if (p === "/api/tunnel/start" && req.method === "POST") {
    const tunnel = require("./tunnel");
    const port = parseInt(global.settings?.website?.port || "3001", 10);
    const result = await tunnel.start(port, body || {});
    return send(res, 200, result);
  }
  if (p === "/api/tunnel/stop" && req.method === "POST") {
    const tunnel = require("./tunnel");
    const result = tunnel.stop();
    return send(res, 200, result);
  }
  if (p === "/api/bots/whatsapp/pair") {
    const number = String(body && body.number || "").replace(/[^0-9]/g, "");
    if (!number || number.length < 8) return send(res, 400, {
      ok: false,
      message: "Valid phone number required (country code + number)."
    });
    const sock = global.sock;
    if (!sock) return send(res, 503, {
      ok: false,
      message: "WhatsApp runtime not started. Restart bot first."
    });
    const wsReady = sock.ws && sock.ws.readyState === 1;
    if (!wsReady) {
      return send(res, 503, {
        ok: false,
        message: "WhatsApp still connecting... wait a few seconds and try again."
      });
    }
    if (sock.authState?.creds?.registered) {
      return send(res, 409, {
        ok: false,
        message: "Session already registered. Reset session first to re-pair."
      });
    }
    try {
      const code = await Promise.race([ sock.requestPairingCode(number), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout — connection too slow")), 15e3)) ]);
      const pretty = String(code || "").match(/.{1,4}/g)?.join("-") || code;
      store.audit("wa.pair", "ok", number.slice(-4));
      return send(res, 200, {
        ok: true,
        code: pretty,
        message: "Open WhatsApp > Settings > Linked Devices > Link with phone number, then enter this code."
      });
    } catch (e) {
      const msg = String(e.message || "");
      if (/Connection Closed|timeout/i.test(msg)) {
        return send(res, 502, {
          ok: false,
          message: "WhatsApp server rejected the request. Check your internet, wait 10 seconds and try again."
        });
      }
      store.audit("wa.pair", "failed", msg.slice(0, 80));
      return send(res, 502, {
        ok: false,
        message: "Pairing failed: " + msg.slice(0, 120)
      });
    }
  }
  if (p === "/api/bots/whatsapp/reset-session") {
    if (!body || body.confirm !== "RESET") return send(res, 400, {
      ok: false,
      message: "Type RESET to confirm."
    });
    const info = waSessionInfo();
    try {
      const full = path.join(process.cwd(), info.authDir);
      for (const f of [ "creds.json", "store.json", "store-group.json", "store-contacts.json" ]) {
        try {
          fs.unlinkSync(path.join(full, f));
        } catch {}
      }
      store.audit("wa.resetSession", "ok");
      setTimeout(() => {
        if (typeof process.send === "function") process.send("reset"); else process.exit(0);
      }, 400);
      return send(res, 200, {
        ok: true,
        message: "Session cleared. Bot restarting for a fresh link."
      });
    } catch (e) {
      return send(res, 500, {
        ok: false,
        message: e.message
      });
    }
  }
  if (p === "/api/logs/clear") {
    clearBuffers();
    store.audit("logs.clear", "ok");
    return send(res, 200, {
      ok: true,
      message: "In-memory log/message buffers cleared."
    });
  }
  if (p === "/api/broadcast") {
    const platforms = Array.isArray(body && body.platforms) ? body.platforms.filter(x => [ "whatsapp", "telegram", "discord" ].includes(x)) : [];
    const text = String(body && body.text || "").trim();
    if (!text) return send(res, 400, {
      ok: false,
      message: "Text is required."
    });
    if (text.length > 2e3) return send(res, 400, {
      ok: false,
      message: "Text too long (max 2000)."
    });
    if (!platforms.length) return send(res, 400, {
      ok: false,
      message: "Pick at least one platform."
    });
    const db = (() => {
      try {
        return require("../../../../database").get();
      } catch {
        return {};
      }
    })();
    const targets = body && body.targets || {};
    const allGroups = !!(body && body.all_groups);
    const dry = !!(body && body.dry);
    const plan = [];
    const failures = [];
    let sent = 0;
    if (platforms.includes("telegram")) {
      let ids = Array.isArray(targets.telegram) ? targets.telegram.map(String).filter(x => /^-?\d{5,}$/.test(x)) : [];
      if (allGroups || ids.length === 0) ids = Object.keys(db.telegram && db.telegram.groups || {});
      for (const id of [ ...new Set(ids) ]) plan.push({
        platform: "telegram",
        target: id
      });
    }
    if (platforms.includes("discord")) {
      const dc = global.discordBot && global.discordBot.client;
      let ids = Array.isArray(targets.discord) ? targets.discord.map(String).filter(x => /^\d{15,}$/.test(x)) : [];
      if ((allGroups || ids.length === 0) && dc) {
        for (const guild of dc.guilds.cache.values()) {
          const ch = guild.systemChannelId || guild.channels.cache.find(c => c.type === 0 && c.permissionsFor(guild.members.me)?.has("SendMessages"))?.id;
          if (ch) ids.push(ch);
        }
      }
      for (const id of [ ...new Set(ids) ]) plan.push({
        platform: "discord",
        target: id
      });
    }
    if (platforms.includes("whatsapp")) {
      let jids = Array.isArray(targets.whatsapp) ? targets.whatsapp.map(x => String(x).replace(/[^0-9]/g, "")).filter(Boolean).map(x => x + "@g.us") : [];
      if (allGroups || jids.length === 0) jids = Object.keys(db.chats || {}).filter(j => j.endsWith("@g.us"));
      for (const jid of [ ...new Set(jids) ]) plan.push({
        platform: "whatsapp",
        target: jid
      });
    }
    if (dry) return send(res, 200, {
      ok: true,
      dry: true,
      total: plan.length,
      plan: plan.slice(0, 50),
      message: `Dry run: would send to ${plan.length} destination(s).`
    });
    for (const item of plan) {
      try {
        if (item.platform === "telegram") {
          const tg = global.telegramBot && global.telegramBot.bot;
          if (!tg || !tg.telegram) throw new Error("Telegram offline");
          await tg.telegram.sendMessage(item.target, text);
        } else if (item.platform === "discord") {
          const dc = global.discordBot && global.discordBot.client;
          const ch = dc ? await dc.channels.fetch(item.target).catch(() => null) : null;
          if (!ch || typeof ch.send !== "function") throw new Error("channel unavailable");
          await ch.send(text);
        } else if (item.platform === "whatsapp") {
          const sock = global.sock;
          if (!sock || !sock.user) throw new Error("WhatsApp not linked — pair first via Bots page");
          const sessDir = path.join(process.cwd(), String(global.settings && global.settings.sessions || "sessions"), "creds.json");
          if (!fs.existsSync(sessDir)) throw new Error("WhatsApp session invalid (no creds.json)");
          await sock.sendMessage(item.target, {
            text: text
          });
        }
        sent++;
      } catch (e) {
        failures.push({
          ...item,
          error: String(e.message || e).slice(0, 120)
        });
        getFeatures().addFailed(item.platform, item.target, text, String(e.message || e));
      }
      await new Promise(r => setTimeout(r, 350));
    }
    store.audit("broadcast", platforms.join("+"), `${sent} sent`);
    return send(res, 200, {
      ok: true,
      sent: sent,
      failed: failures.length,
      failures: failures.slice(0, 20),
      message: `Broadcast done: ${sent} sent, ${failures.length} failed.`
    });
  }
  if (p === "/api/dev/write") {
    const key = body && body.key;
    const full = safeDevPath(key, body && body.f);
    if (!full) return send(res, 400, {
      ok: false,
      message: "invalid path"
    });
    const content = String(body.content ?? "");
    if (content.length > 4e5) return send(res, 400, {
      ok: false,
      message: "file too large"
    });
    const syntaxErr = require("syntax-error")(content, path.basename(full));
    if (syntaxErr) {
      return send(res, 400, {
        ok: false,
        message: "Syntax error, not saved: " + String(syntaxErr).split("\n").slice(0, 3).join(" ")
      });
    }
    try {
      if (fs.existsSync(full)) {
        fs.copyFileSync(full, full + ".bak");
      } else {
        fs.mkdirSync(path.dirname(full), {
          recursive: true
        });
      }
      fs.writeFileSync(full, content);
      store.audit("dev.write", "ok", key + ":" + (body.f || "").slice(-60));
      return send(res, 200, {
        ok: true,
        message: "Saved. WhatsApp/scrapers hot-reload automatically; use Reload plugins for Discord/Telegram."
      });
    } catch (e) {
      return send(res, 500, {
        ok: false,
        message: e.message
      });
    }
  }
  if (p === "/api/bots/token") {
    const {platform: platform, token: token} = body || {};
    if (![ "telegram", "discord" ].includes(platform)) return send(res, 400, {
      ok: false,
      message: "platform must be telegram or discord"
    });
    const t = String(token || "").trim();
    const okShape = platform === "telegram" ? /^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(t) : /^[A-Za-z0-9._\-]{50,}$/.test(t);
    if (!okShape) return send(res, 400, {
      ok: false,
      message: "Token format looks wrong for " + platform
    });
    const overlay = store.getOverlay();
    overlay.settings = overlay.settings || {};
    overlay.settings[platform] = Object.assign({}, overlay.settings[platform], {
      tokenOverride: t
    });
    store.saveOverlay(overlay);
    global.settings = global.settings || {};
    global.settings[platform] = Object.assign({}, global.settings[platform], {
      token: t
    });
    store.audit(platform + ".token.set", "ok");
    return send(res, 200, {
      ok: true,
      message: platform + " token saved (masked). Restart the bot to reconnect with it."
    });
  }
  if (p === "/api/telegram/send") {
    try {
      const {chatId: chatId, text: text} = body || {};
      if (!chatId || !text) return send(res, 400, {
        ok: false,
        message: "chatId and text required"
      });
      const result = await sendChatMessage("telegram", chatId, text);
      return send(res, 200, {
        ok: true,
        ...result
      });
    } catch (e) {
      return send(res, 500, {
        ok: false,
        message: e.message
      });
    }
  }
  if (p === "/api/chats/send") {
    try {
      const {platform: platform, chatId: chatId, text: text, message: message} = body || {};
      const msg = text || message || "";
      if (!platform || !chatId || !msg) return send(res, 400, {
        ok: false,
        message: "platform, chatId, and text required"
      });
      const result = await sendChatMessage(platform, chatId, msg);
      return send(res, 200, {
        ok: true,
        ...result
      });
    } catch (e) {
      return send(res, 500, {
        ok: false,
        message: e.message
      });
    }
  }
  const chatSendMatch = p.match(/^\/api\/chats\/([^\/]+)\/(.+)\/send$/);
  if (chatSendMatch) {
    const platform = chatSendMatch[1];
    const chatId = decodeURIComponent(chatSendMatch[2] || "");
    const text = body?.text || body?.message || "";
    if (!platform || !chatId || !text) return send(res, 400, {
      ok: false,
      message: "platform, chatId, and text required"
    });
    try {
      const result = await sendChatMessage(platform, chatId, text);
      return send(res, 200, {
        ok: true,
        ...result
      });
    } catch (e) {
      return send(res, 500, {
        ok: false,
        message: e.message
      });
    }
  }
  return null;
}

module.exports = {
  handleApi: handleApi,
  handleAction: handleAction,
  botStatus: botStatus,
  applyOverlayToRuntime: applyOverlayToRuntime,
  json: json
};

module.exports.botAvatar = botAvatar;