const fs = require("fs");
const path = require("path");
const {Cooldown: Cooldown, SpamDetection: SpamDetection, matcher: matcher, texted: texted, toTime: toTime, generateLink: generateLink, socmed: socmed} = require("./cooldown");
const {Notifier: Notifier, getPermission: getPermission, isOwner: isOwner, isPremium: isPremium, isAdmin: isAdmin, isBotAdmin: isBotAdmin} = require("./permission");
const {isLink: isLink, isVirtex: isVirtex, extractLinks: extractLinks, AntiDelete: AntiDelete} = require("./anti");

const cooldown = new Cooldown(5e3);

const spam = new SpamDetection({
  RESET_TIMER: 5e3,
  HOLD_THRESHOLD: 5,
  PERM_T: 10,
  BAN_T: 15
});

const antiDelete = new AntiDelete;

let notifier = null;

function initSystem(sock, global) {
  notifier = new Notifier(sock, `${global.settings?.connection?.owner || ""}@s.whatsapp.net`);
  global.system = {
    cooldown: cooldown,
    spam: spam,
    antiDelete: antiDelete,
    notifier: notifier,
    texted: texted,
    toTime: toTime
  };
}

async function systemHandler(sock, message, global) {
  const {messages: messages, type: type} = message;
  if (type !== "notify") return;
  for (const msg of messages) {
    if (!msg.message) continue;
    if (msg.key.fromMe) continue;
    if (msg.key.remoteJid === "status@broadcast") continue;
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const isGroup = from.endsWith("@g.us");
    const groupSet = global.db?.groups?.find?.(v => v.jid === from);
    const users = global.db?.users?.find?.(v => v.jid === sender);
    const setting = global.db?.setting || global.settings;
    const prefix = setting?.prefix?.[0] || ".";
    const prefixes = setting?.prefix || [ ".", "#", "!", "/" ];
    const usedPrefix = prefixes.find(p => body.startsWith(p)) || "";
    const command = usedPrefix ? body.slice(usedPrefix.length).trim().split(/\s+/)[0].toLowerCase() : "";
    const args = usedPrefix ? body.slice(usedPrefix.length + command.length).trim().split(/\s+/) : [];
    const text = args.join(" ");
    const perm = getPermission(sender, global);
    const owner = perm === "owner";
    const premium = perm === "owner" || perm === "premium";
    if (isGroup && groupSet) {
      if (!global.db.groupMessages) global.db.groupMessages = {};
      if (!global.db.groupMessages[from]) global.db.groupMessages[from] = [];
      global.db.groupMessages[from].push({
        key: msg.key,
        message: msg.message,
        sender: sender,
        timestamp: Date.now()
      });
      if (global.db.groupMessages[from].length > 500) {
        global.db.groupMessages[from] = global.db.groupMessages[from].slice(-500);
      }
    }
    if (isGroup && groupSet?.mute) continue;
    if (isGroup && setting?.antilink !== false && groupSet?.antilink && !owner && !premium) {
      if (isLink(body)) {
        try {
          await sock.sendMessage(from, {
            delete: msg.key
          });
          await sock.reply(from, `@${sender.split("@")[0]} links are not allowed!`, msg, {
            mentions: [ sender ]
          });
        } catch {}
        continue;
      }
    }
    if (isGroup && setting?.antivirtex !== false && groupSet?.antivirtex && !owner && !premium) {
      if (isVirtex(body)) {
        try {
          await sock.sendMessage(from, {
            delete: msg.key
          });
          await sock.reply(from, `@${sender.split("@")[0]} long text is not allowed!`, msg, {
            mentions: [ sender ]
          });
        } catch {}
        continue;
      }
    }
    if (users) {
      if (users.afk > -1) {
        const duration = Date.now() - users.afk;
        const reason = users.afkReason || "-";
        await sock.reply(from, `@${sender.split("@")[0]} active after AFK for ${toTime(duration)}\nReason: ${reason}`, msg, {
          mentions: [ sender ]
        });
        users.afk = -1;
        users.afkReason = "";
      }
      users.lastseen = Date.now();
      users.hit = (users.hit || 0) + 1;
    }
    if (!command) continue;
    const commands = [];
    const plugsDir = path.join(__dirname, "..", "plugins");
    try {
      const scanDir = dir => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const fullPath = path.join(dir, file);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            scanDir(fullPath);
          } else if (file.endsWith(".js")) {
            try {
              const plug = require(fullPath);
              if (plug.help || plug.command) {
                const cmds = plug.help || plug.command || [];
                if (Array.isArray(cmds)) commands.push(...cmds); else commands.push(cmds);
              }
            } catch {}
          }
        }
      };
      scanDir(plugsDir);
    } catch {}
    const spamResult = spam.detection(sender, {});
    if (spamResult.state === "BANNED") {
      if (users) users.banned = true;
      await sock.reply(from, spamResult.msg, msg);
      continue;
    }
    if (spamResult.state === "HOLD") continue;
    if (spamResult.state === "NOTIFY") {
      await sock.reply(from, spamResult.msg, msg);
    }
    if (cooldown.has(sender, command)) {
      const remaining = cooldown.get(sender, command);
      await sock.reply(from, `Cooldown! Wait ${Math.ceil(remaining / 1e3)}s`, msg);
      continue;
    }
    if (!commands.includes(command)) {
      const suggestions = matcher(command, commands).slice(0, 3);
      if (suggestions.length > 0) {
        const caption = `Command not found. Did you mean:\n${suggestions.map((s, i) => `${i + 1}. ${prefix}${s.string} (${s.accuracy}%)`).join("\n")}\n\nReply with number to execute.`;
        await sock.reply(from, caption, msg);
      }
      continue;
    }
    cooldown.set(sender, command, 5e3);
    if (setting?.self && !owner && !msg.key.fromMe) continue;
    if (setting?.groupmode && !premium && !isGroup) {
      await sock.reply(from, "Bot only works in groups. Upgrade to premium for DM access.", msg);
      continue;
    }
    if (setting?.owners && !setting.owners.includes(sender.split("@")[0]) && !isGroup) {
      if (!premium && !owner) continue;
    }
  }
}

function antiDel(sock, update, global) {
  const {messages: messages, type: type} = update;
  if (type !== "notify") return;
  for (const msg of messages) {
    if (!msg.message) continue;
    const key = `${msg.key.remoteJid}:${msg.key.id}`;
    global.system?.antiDelete?.store(key, {
      key: msg.key,
      message: msg.message,
      sender: msg.key.participant || msg.key.remoteJid,
      chat: msg.key.remoteJid,
      timestamp: Date.now()
    });
  }
}

function delHandler(sock, update, global) {
  if (!update?.key) return;
  const {key: key} = update;
  const groupSet = global.db?.groups?.find?.(v => v.jid === key.remoteJid);
  if (!groupSet?.antidelete) return;
  if (key.fromMe) return;
  const stored = global.system?.antiDelete?.get(`${key.remoteJid}:${key.id}`);
  if (!stored) return;
  try {
    sock.forwardMessage(key.remoteJid, stored, false);
  } catch {}
}

module.exports = {
  initSystem: initSystem,
  systemHandler: systemHandler,
  antiDel: antiDel,
  delHandler: delHandler
};