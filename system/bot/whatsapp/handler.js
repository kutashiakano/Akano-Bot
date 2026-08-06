require("../../../settings");
const simple = require("./lib");
const util = require("util");
const moment = require("moment-timezone");
const fs = require("fs");

const path = require("path");
const { isJidNewsletter } = require("baileys");
const { Cooldown, SpamDetection, matcher } = require("./lib/cooldown");
const { isVirtex, extractLinks } = require("./lib/anti");

const getCooldown = () => global.settings?.system?.cooldown || 5000;
const getSpamConfig = () => ({
  RESET_TIMER: global.settings?.system?.spam?.resetTimer || 5000,
  HOLD_THRESHOLD: global.settings?.system?.spam?.holdThreshold || 5,
  PERMANENT_THRESHOLD: global.settings?.system?.spam?.permanentThreshold || 10,
  BANNED_THRESHOLD: global.settings?.system?.spam?.bannedThreshold || 15,
  NOTIFY_THRESHOLD: global.settings?.system?.spam?.notifyThreshold || 3,
});

const cooldown = new Cooldown(getCooldown());
const spam = new SpamDetection(getSpamConfig());

const dbTexts = () => {
  const t = global.db?.data?.texts;
  return t && Object.keys(t).length ? t : global.texts || {};
};
const pickRandom = (arr) =>
  Array.isArray(arr) && arr.length
    ? arr[Math.floor(Math.random() * arr.length)]
    : "";

if (!global.typo) global.typo = new Map();

const groupMetadataCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000;

async function getCachedGroupMetadata(sock, chat) {
  const cached = groupMetadataCache.get(chat);
  if (cached && Date.now() - cached.time < CACHE_TTL) return cached.data;
  const metadata = await store.fetchGroupMetadata(chat, sock);
  groupMetadataCache.set(chat, { data: metadata, time: Date.now() });
  return metadata;
}

function scheduleDailyReset() {
  const resetHour = 0;
  const resetMinute = 0;

  function getNextResetTime() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(resetHour, resetMinute, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next.getTime() - now.getTime();
  }

  function doReset() {
    if (global.db.data?.settings) {
      global.db.data.settings.lastReset = Date.now();
    }
    if (global.db.data?.users) {
      const limit = global.settings?.limit?.freeUser || 15;
      Object.values(global.db.data.users).forEach((v) => {
        if (!v.premium && typeof v.limit === "number" && v.limit < 100) {
          v.limit = limit;
        }
      });
    }
    if (global.db.data?.stats) {
      Object.values(global.db.data.stats).forEach((prop) => {
        if (prop) prop.today = 0;
      });
    }
    setTimeout(doReset, 86400000);
  }

  setTimeout(doReset, getNextResetTime());
}
scheduleDailyReset();

module.exports = {
  async handler(chatUpdate) {
    if (global.db.data == null) await global.loadDatabase();
    this.msgqueque = this.msgqueque || [];
    let m = chatUpdate.messages[chatUpdate.messages.length - 1];
    if (!m) return;
    if (m.message?.viewOnceMessageV2)
      m.message = m.message.viewOnceMessageV2.message;
    if (m.message?.documentWithCaptionMessage)
      m.message = m.message.documentWithCaptionMessage.message;
    if (m.message?.viewOnceMessageV2Extension)
      m.message = m.message.viewOnceMessageV2Extension.message;
    if (!m) return;

    try {
      m = simple.smsg(this, m) || m;
      if (!m) return;
      if (!m.sender || typeof m.sender !== "string") return;
      if (!m.chat || typeof m.chat !== "string") return;
      m.exp = 0;
      m.limit = false;

      if (m.isGroup && typeof m.sender === "string") {
        try {
          const groupMeta = await store.fetchGroupMetadata(m.chat, this);
          if (m.sender.endsWith("lid")) {
            const found = groupMeta.participants?.find(
              (v) => (typeof v.lid === "string" && v.lid === m.sender) || (typeof v.id === "string" && v.id === m.sender)
            );
            if (found && typeof found.phoneNumber === "string") m.sender = found.phoneNumber;
          }
          if (m.quoted && typeof m.quoted.sender === "string" && m.quoted.sender.endsWith("lid")) {
            const found = groupMeta.participants?.find(
              (v) => (typeof v.lid === "string" && v.lid === m.quoted.sender) || (typeof v.id === "string" && v.id === m.quoted.sender)
            );
            if (found && typeof found.phoneNumber === "string") m.quoted.sender = found.phoneNumber;
          }
        } catch (e) {}
      }

      const isNewsletter = isJidNewsletter(m.sender);
      if (isNewsletter) return;

      try {
        require("../../database").ensureWhatsApp(global.db.data, m);
      } catch (e) {}

      if (typeof m.sender !== "string") return;
      if (!m.sender.includes("@")) return;
      if (typeof m.chat !== "string") return;

      const isROwner = [
        sock.decodeJid(global.sock.user.id),
        ...global.owner.map((a) => a + "@s.whatsapp.net"),
      ].includes(m.sender);
      const isOwner = isROwner || m.fromMe;
      const isMods = global.db.data.users[m.sender]?.moderator || false;
      const isPrems = global.db.data.users[m.sender]?.premium || false;
      const isBans = global.db.data.users[m.sender]?.banned || false;

      let groupSet = global.db.data.chats[m.chat] || {};
      let chats = global.db.data.chats[m.chat] || {};
      let users = global.db.data.users[m.sender] || {};
      let setting = global.db.data.settings || global.settings;

      if (m.isGroup) {
        if (!global.db.data.chats[m.chat]) {
          global.db.data.chats[m.chat] = { welcome: true, mute: false, member: [], chat: 0, expired: 0 };
        }
        let member = (
          await store.fetchGroupMetadata(m.chat, this)
        ).participants.map((a) => a.id);
        db.data.chats[m.chat].member = member;
        db.data.chats[m.chat].chat = (db.data.chats[m.chat].chat || 0) + 1;
      }

      if (isROwner && db.data.users[m.sender]) {
        db.data.users[m.sender].premium = true;
        db.data.users[m.sender].limit = "PERMANENT";
        db.data.users[m.sender].moderator = true;
      } else if (isPrems && db.data.users[m.sender]) {
        db.data.users[m.sender].limit = "PERMANENT";
      } else if (!isROwner && isBans) return;

      if (m.text && !isOwner && !isPrems && !isMods) {
        const spamResult = spam.detection(m.sender, {});
        if (spamResult.state === "BANNED") {
          if (db.data.users[m.sender]) db.data.users[m.sender].banned = true;
          m.reply(global.settings?.message?.banned || spamResult.msg);
          return;
        }
        if (spamResult.state === "HOLD") return;
        if (spamResult.state === "NOTIFY") {
          m.reply(global.settings?.message?.spam || spamResult.msg);
        }
      }

      if (m.isGroup) {
        const chat = db.data.chats[m.chat] || {};
        const senderNum = m.sender.split(":")[0].split("@")[0];
        const botJid = (this.user.id || "").split(":")[0].split("@")[0];
        const _groupMeta = await getCachedGroupMetadata(this, m.chat);
        const _participants = _groupMeta?.participants || [];
        const _senderParticipant = _participants.find((u) => sock.decodeJid(u.id) === m.sender) || {};
        const _botParticipant = _participants.find((u) => sock.decodeJid(u.id) == sock.decodeJid(this.user.id)) || {};
        const senderIsAdmin = _senderParticipant.admin === "admin" || _senderParticipant.admin === "superadmin";
        const botIsAdmin = _botParticipant.admin === "admin" || _botParticipant.admin === "superadmin";
        const antilinkGlobal = global.settings?.group?.antilink || false;
        const antivirtexGlobal = global.settings?.group?.antivirtex || false;

        if ((chat.antilink || antilinkGlobal) && !senderIsAdmin && !isOwner && m.text) {
          const links = extractLinks(m.text);
          if (links.length > 0) {
            if (botIsAdmin) {
              try { await this.sendMessage(m.chat, { delete: m.key }); } catch {}
            }
            m.reply(global.settings?.message?.antilink || `@${senderNum} links are not allowed in this group!`, null, { mentions: [m.sender] });
            return;
          }
        }

        if ((chat.antivirtex || antivirtexGlobal) && !senderIsAdmin && !isOwner && m.text) {
          if (isVirtex(m.text)) {
            if (botIsAdmin) {
              try { await this.sendMessage(m.chat, { delete: m.key }); } catch {}
            }
            m.reply(global.settings?.message?.antivirtex || `@${senderNum} long text is not allowed in this group!`, null, { mentions: [m.sender] });
            return;
          }
        }
      }

      if ((global.settings.opts.queque || global.settings.opts.pending) && m.text && !(isMods || isPrems)) {
        let queque = this.msgqueque,
          time = 1000 * 5;
        const previousID = queque[queque.length - 1];
        queque.push(m.id || m.key.id);
        setInterval(async function () {
          if (queque.indexOf(previousID) === -1) clearInterval(this);
          else await sock.delay(time);
        }, time);
      }

      if (!db.data.users[m.sender]) {
        db.data.users[m.sender] = { exp: 0, limit: 100, money: 10000, registered: false, name: m.name, premium: false, moderator: false, banned: false, level: 1, warn: 0, online: Date.now(), hit: 0 };
      } else {
        db.data.users[m.sender].online = Date.now();
        db.data.users[m.sender].hit = (db.data.users[m.sender].hit || 0) + 1;
      }
      if (opts["autoRead"] || global.settings?.automation?.autoRead) await this.readMessages([m.key]).catch(() => {});
      if (global.settings?.automation?.autoTyping) {
        await this.sendPresenceUpdate("composing", m.chat).catch(() => {});
      }

      if (!m.fromMe && !isOwner && !isPrems && !isMods && opts["selfMode"])
        return;
      if (opts["dmOnly"] && m.chat.endsWith("g.us")) return;
      if (opts["statusOnly"] && m.chat !== "status@broadcast") return;

      if (setting.groupmode && !m.isGroup && !isPrems && !isOwner && !m.fromMe) {
        m.reply(`⚠️ Using bot in private chat only for premium user, want to upgrade to premium plan? send *.premium* to see benefit and prices.`);
        return;
      }

      if (typeof m.text !== "string") m.text = "";

      require("./lib/button-response")(m);

      if (m.isBaileys) return;
      m.exp += Math.ceil(Math.random() * 1000);

      let usedPrefix;
      const groupMetadata = m.isGroup ? await getCachedGroupMetadata(this, m.chat) : {};
      const participants = (m.isGroup ? groupMetadata.participants : []) || [];
      const user = (m.isGroup ? participants.find((u) => {
        const uid = sock.decodeJid(u.id);
        return uid === m.sender || u.lid === m.sender || u.phoneNumber === m.sender;
      }) : {}) || {};
      const botId = sock.decodeJid(this.user.id);
      const botLid = this.user.id;
      const bot = (m.isGroup ? participants.find((u) => {
        const uid = sock.decodeJid(u.id);
        return uid === botId || u.lid === botLid || u.lid === botId || uid === botLid;
      }) : {}) || {};
      const isRAdmin = (user && user.admin == "superadmin") || false;
      const isAdmin = isRAdmin || (user && user.admin == "admin") || false;
      const isBotAdmin = (bot && bot.admin) || false;

      let isCommand = false;

      if (setting.debug && !m.fromMe && isOwner) {
        const debugInfo = {
          sender: m.sender,
          chat: m.chat,
          isGroup: m.isGroup,
          isOwner,
          isPrems,
          isAdmin,
          text: m.text?.substring(0, 100),
        };
        m.reply(`🔍 *DEBUG*\n\`\`\`${JSON.stringify(debugInfo, null, 2)}\`\`\``);
      }

      for (let name in global.plugin) {
        let pl = global.plugin[name];
        if (!pl) continue;
        if (typeof pl.before === "function" && !pl.command) {
          try {
            await pl.before.call(this, m, {
              sock: this,
              store,
              isOwner,
              isROwner,
              isMods,
              isPrems,
              isBans,
            });
          } catch (e) {}
        }
      }

      for (let name in global.plugin) {
        let plugins = global.plugin[name];
        if (!plugins) continue;

        if (typeof plugins === "function") {
          plugins = {
            run: plugins,
            command: plugins.command || [],
            help: plugins.help || [],
            example: plugins.example || "",
            wait: plugins.wait || false,
            owner: plugins.owner || false,
            rowner: plugins.rowner || false,
            group: plugins.group || false,
            private: plugins.private || false,
            botAdmin: plugins.botAdmin || false,
            premium: plugins.premium || false,
            admin: plugins.admin || false,
            error: plugins.error || 0,
            before: plugins.before,
            customPrefix: plugins.customPrefix || null,
            limit: plugins.limit || false,
          };
        }

        if (setting.pluginDisable && setting.pluginDisable.includes(path.basename(name, ".js"))) {
          continue;
        }

        const str2Regex = (str) => str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&");
        let _prefix = plugins.customPrefix ?
          plugins.customPrefix :
          sock.prefix ?
          sock.prefix :
          global.prefix;

        let match = (
          _prefix instanceof RegExp ? [
            [_prefix.exec(m.text), _prefix]
          ] :
          Array.isArray(_prefix) ?
          _prefix.map((p) => {
            let re = p instanceof RegExp ? p : new RegExp(str2Regex(p));
            return [re.exec(m.text), re];
          }) :
          typeof _prefix === "string" ? [
            [
              new RegExp(str2Regex(_prefix)).exec(m.text),
              new RegExp(str2Regex(_prefix)),
            ],
          ] : [
            [
              [], new RegExp()
            ]
          ]
        ).find((p) => p[1]);

        if (!match) continue;

        if (typeof plugins.before === "function") {
          if (
            await plugins.before.call(this, m, {
              match,
              sock: this,
              participants,
              groupMetadata,
              user,
              bot,
              isROwner,
              isOwner,
              isRAdmin,
              isAdmin,
              isBotAdmin,
              isPrems,
              isBans,
              chatUpdate,
            })
          )
            continue;
        }

        if (typeof plugins.run !== "function") continue;

        if (opts && match && m) {
          let result =
            ((opts?.["multiprefix"] ?? true) && (match[0] || "")[0]) ||
            ((opts?.["noprefix"] ?? false) ? null : (match[0] || "")[0]);
          usedPrefix = result;
          let noPrefix = isOwner ?
            !result ?
            m.text :
            m.text.replace(result, "") :
            !result ?
            "" :
            m.text.replace(result, "").trim();

          let [command, ...args] = noPrefix.trim().split` `.filter((v) => v);
          args = args || [];
          let _args = noPrefix.trim().split` `.slice(1);
          let text = _args.join` `;
          command = (command || "").toLowerCase();

          let fail = plugins.fail || global.dfail;
          const prefixCommand = !result ?
            plugins.customPrefix || plugins.command :
            plugins.command;

          let isAccept =
            (prefixCommand instanceof RegExp && prefixCommand.test(command)) ||
            (Array.isArray(prefixCommand) &&
              prefixCommand.some((cmd) =>
                cmd instanceof RegExp ? cmd.test(command) : cmd === command,
              )) ||
            (typeof prefixCommand === "string" && prefixCommand === command);

          if (!isAccept) continue;

          isCommand = true;
          m.plugins = name;
          m.chatUpdate = chatUpdate;

          if (m.isCmd && !isOwner && !isPrems && !isMods) {
            if (cooldown.has(m.sender, command)) {
              const remaining = cooldown.get(m.sender, command);
              m.reply(global.settings?.message?.cooldown || `Cooldown! Wait ${Math.ceil(remaining / 1000)}s`);
              continue;
            }
            cooldown.set(m.sender, command, getCooldown());
          }

          if (opts["groupOnly"] && !m.fromMe && !m.chat.endsWith("g.us")) {
            let contactOwner = global.owner.map((a, i) => `*• Contact ${i + 1} :* wa.me/` + a).join("\n");
            await sock.sendMessage(
              m.chat, {
                text: `We apologize, but the bot is currently only accessible within groups. If you wish to use the bot privately, please upgrade your status. If you are interested, please contact our owner below:\n${contactOwner}`,
              }, {
                quoted: m
              },
            );
            continue;
          }

          if (
            m.chat in global.db.data.chats ||
            m.sender in global.db.data.users
          ) {
            let chat = global.db.data.chats[m.chat];
            let user = global.db.data.users[m.sender];

            if (
              name != "owner-unbanchat.js" &&
              chat &&
              chat.isBanned &&
              !isOwner
            )
              return;
            if (
              name != "group-unmute.js" &&
              chat &&
              chat.mute &&
              !isAdmin &&
              !isOwner
            )
              return;
          }

          if (plugins.example && command && !text) {
            let txt = plugins.example.replace("%cmd", usedPrefix + command);
            m.reply(`༚ *Example* : ${txt}`);
            continue;
          }

          if (db.data.settings?.blockcmd?.includes(command)) {
            m.reply(settings.message.errorF);
            continue;
          }

          if (plugins.error >= 5) {
            if (!db.data.settings) db.data.settings = { blockcmd: [] };
            if (!Array.isArray(db.data.settings.blockcmd)) db.data.settings.blockcmd = [];
            if (!db.data.settings.blockcmd.includes(command)) db.data.settings.blockcmd.push(command);
            m.reply(settings.message.errorF);
            continue;
          }

          if (plugins.group && !m.isGroup) {
            m.reply(settings.message.group);
            continue;
          }

          if (plugins.admin && !isAdmin) {
            m.reply(settings.message.admin);
            continue;
          }

          if (plugins.owner && !isOwner) {
            m.reply(settings.message.owner);
            continue;
          }

          if (plugins.rowner && !isROwner) {
            m.reply(settings.message.owner);
            continue;
          }

          if (plugins.premium && !isPrems) {
            m.reply(settings.message.premium);
            continue;
          }

          if (plugins.botAdmin && !isBotAdmin) {
            m.reply(settings.message.botadmin);
            continue;
          }

          if (plugins.limit && users && typeof users.limit === "number" && users.limit < 1 && !isPrems && !isOwner) {
            m.reply(`⚠️ Your limit has been reached. Please wait until reset.`);
            continue;
          }

          m.isCmd = true;
          m.cmd = command;

          if (plugins.wait && m.isCmd) {
            m.react("⌛");
            m.reply(settings.message.wait);
          }

          let xp = "exp" in plugins ? parseInt(plugins.exp) : 17;
          m.exp += xp;

          if (
            plugins.limit &&
            users &&
            typeof users.limit === "number" &&
            users.limit > 0 &&
            !isPrems &&
            !isOwner
          ) {
            const cost = plugins.limit.constructor.name === "Boolean" ? 1 : plugins.limit;
            if (users.limit >= cost) {
              users.limit -= cost;
            } else {
              m.reply(`⚠️ Your limit is not enough to use this feature.`);
              continue;
            }
          }

          let extra = {
            match,
            usedPrefix,
            noPrefix,
            args,
            command,
            text,
            sock: this,
            participants,
            groupMetadata,
            user,
            bot,
            isROwner,
            isOwner,
            isRAdmin,
            isAdmin,
            isBotAdmin,
            isPrems,
            isBans,
            chatUpdate,
            pushname: m.pushName || "",
            senderPhone: m.sender.split(":")[0].split("@")[0],
            _receivedAt: Date.now(),
          };

          try {
            await plugins.run.call(this, m, extra);
            if (!isPrems) m.limit = m.limit || plugins.limit || true;
          } catch (e) {
            m.error = e;
            if (m._pluginHandledError) return;
            if (e) {
              let text = util.format(e);
              if (text.match("rate-overlimit")) return;
              if (e.name) {
                plugins.error += 1;
                global.logError("whatsapp.plugin", e);
                if (plugins.error >= 5) {
                  if (!db.data.settings) db.data.settings = { blockcmd: [] };
                  if (!Array.isArray(db.data.settings.blockcmd)) db.data.settings.blockcmd = [];
                  if (!db.data.settings.blockcmd.includes(command)) db.data.settings.blockcmd.push(command);
                }
                m.reply(settings.message.error);
              }
            }
          } finally {}
          break;
        }
      }

      if (!isCommand && m.text) {
        const body = m.text.trim();
        const senderKey = m.sender;

        if (body && !isNaN(body) && global.typo.has(senderKey)) {
          let session = global.typo.get(senderKey);
          let choice = parseInt(body) - 1;

          if (session.commands && session.commands[choice]) {
            let selectedCommand = session.commands[choice];
            clearTimeout(session.timeout);

            command = selectedCommand;
            prefix = session.prefix;
            text = session.text || "";
            args = session.args || [];
            body = prefix + command + (text ? " " + text : "");

            if (session.quoted) {
              m.quoted = session.quoted;
            }

            global.typo.delete(senderKey);
            await m.reply(`🚀 Executing *${prefix + command}*...`);
            isCommand = true;
          }
        }
      }

      if (!isCommand && m.text && Array.isArray(global.prefix) && global.prefix.some((p) => m.text.startsWith(p))) {
        const allCmds = [];
        for (const name in global.plugin) {
          const pl = global.plugin[name];
          if (pl?.command) {
            if (Array.isArray(pl.command)) allCmds.push(...pl.command);
            else allCmds.push(pl.command);
          }
          if (pl?.help) {
            if (Array.isArray(pl.help)) allCmds.push(...pl.help);
            else allCmds.push(pl.help);
          }
        }
        const usedP = global.prefix.find((p) => m.text.startsWith(p)) || global.prefix[0];
        const inputCmd = m.text.replace(usedP, "").trim().split(/\s+/)[0].toLowerCase();
        if (inputCmd) {
          const suggestions = matcher(inputCmd, [...new Set(allCmds)]).slice(0, 3);
          if (suggestions.length > 0) {
            if (global.typo.has(m.sender)) {
              const old = global.typo.get(m.sender);
              clearTimeout(old.timeout);
            }

            let mime = m.quoted ? m.quoted.mtype : m.mtype;
            let isMedia = /image|video|sticker|audio|document/.test(mime);

            const timeout = setTimeout(() => {
              global.typo.delete(m.sender);
            }, 180000);

            global.typo.set(m.sender, {
              commands: suggestions.map((v) => v.string),
              prefix: usedP,
              text: text,
              args: args,
              quoted: m.quoted ? m.quoted : isMedia ? m : null,
              timeout,
            });

            let caption = `🚩 *Command not found.* Did you mean:\n\n`;
            caption += suggestions.map((v, i) => `*${i + 1}.* ${usedP}${v.string} (${v.accuracy}%)`).join("\n");
            caption += `\n\n> Reply with the *number* to execute. (Expires in 3 minutes)`;

            return m.reply(caption);
          }
        }
      }

      if (!isCommand && m.isGroup) return;
    } catch (e) {
      global.logError("whatsapp.handler", e);
    } finally {
      if (opts["queque"] && m.text) {
        const quequeIndex = this.msgqueque.indexOf(m.id || m.key.id);
        if (quequeIndex !== -1) this.msgqueque.splice(quequeIndex, 1);
      }

      let user;
      let stats = global.db.data.stats;
      if (m) {
        if (m.sender && (user = global.db.data.users[m.sender])) {
          user.exp += m.exp;
          if (typeof user.limit === "number" && typeof m.limit === "number") {
            user.limit -= m.limit * 1;
          }
        }
      }

      await this.chatRead(
        m.chat,
        m.isGroup ? m.sender : undefined,
        m.id || m.key.id,
      ).catch(() => {});
    }
  },

  async participantsUpdate({
    id,
    author,
    participants,
    action
  }) {
    if (opts["selfMode"]) return;
    if (global.isInit) return;

    try {
      if (!id || !action || !Array.isArray(participants) || participants.length === 0) return;

      if (!global.db.data.chats[id]) {
        global.db.data.chats[id] = { welcome: true, left: true, mute: false, member: [], chat: 0, expired: 0 };
      }
      let chat = global.db.data.chats[id];

      let groupMetadata = null;
      try {
        groupMetadata = await this.groupMetadata(id);
      } catch (e) {
        groupMetadata = { subject: id, desc: "", participants: [] };
      }
      const groupName = groupMetadata.subject || id;
      const fallbackPp = path.join(__dirname, "..", "..", "..", "image", "akano.jpg");
      const toJid = (p) => {
        if (typeof p === "string") return p;
        if (p && typeof p.phoneNumber === "string") return p.phoneNumber;
        return p?.id || "";
      };
      const pf = Array.isArray(global.prefix) ? global.prefix[0] : global.prefix || ".";

      switch (action) {
        case "add":
        case "remove":
          if (chat.welcome || (action === "remove" && chat.left)) {
            for (let raw of participants) {
              const user = toJid(raw);
              if (!user || !user.includes("@")) continue;

              const check = typeof author === "string" && author.length > 1;
              const reasn = check
                ? `${action === "add" ? "added" : "removed"} by @${author.split("@")[0]}`
                : `${action === "add" ? "Joined the group" : "Left the group"}`;

              let pp = "";
              try { pp = await this.profilePictureUrl(user, "image"); } catch (e) {}

              const tmpl = action === "add"
                ? chat.sWelcome || chat.welcomeMsg || pickRandom(dbTexts().welcomeMsgs) || "Welcome @user to @subject!\nDon't forget to read the rules!"
                : chat.sBye || chat.leaveMsg || pickRandom(dbTexts().goodbyeMsgs) || "Goodbye @user!\nWe'll miss you!";

              const text = tmpl
                .replace(/@user/g, "@" + user.split("@")[0])
                .replace(/@subject/g, groupName)
                .replace(/@desc/g, groupMetadata.desc?.toString() || "")
                .replace(/%member/g, "@" + user.split("@")[0])
                .replace(/%subject/g, groupName)
                .replace(/%reason/g, reasn)
                .replace(/%time/g, moment.tz("Asia/Jakarta").format("HH:mm"));

              let thumb = null;
              if (pp) {
                try { thumb = await sock.resize(pp, 300, 200); } catch (e) {}
              }
              if (!thumb) {
                try { thumb = fs.readFileSync(fallbackPp); } catch (e) {}
              }

              await sock.sendIAMessage(id, [
                {
                  name: "single_select",
                  buttonParamsJson: JSON.stringify({
                    title: "Select Here",
                    sections: [
                      {
                        title: "Menu",
                        rows: [
                          { title: "Menu", description: "Show bot menu", id: pf + "menu" },
                          { title: "Info Group", description: "Group info", id: pf + "infogroup" },
                        ],
                      },
                    ],
                  }),
                },
              ], null, {
                header: text,
                footer: global.settings.footer || groupName,
                media: {
                  buffer: thumb,
                  name: action === "add" ? pickRandom(dbTexts().welcomeNames) || "Welcome" : pickRandom(dbTexts().goodbyeNames) || "Goodbye",
                  address: action === "add" ? pickRandom(dbTexts().welcomeAddrs) : pickRandom(dbTexts().goodbyeAddrs),
                },
                mentions: [user],
              }).catch((e) => global.logError("whatsapp.sendIAMessage", e));
            }
          }
          break;

        case "promote":
        case "demote":
          const target = toJid(participants[0]);
          if (!target || !target.includes("@")) break;
          if (chat.detect) {
            const tmpl = action === "promote"
              ? chat.sPromote || pickRandom(dbTexts().promoteMsgs) || "@user is now an admin!"
              : chat.sDemote || pickRandom(dbTexts().demoteMsgs) || "@user is no longer an admin.";
            const text = tmpl.replace(/@user/g, "@" + target.split("@")[0]);
            let thumb = null;
            try { thumb = fs.readFileSync(fallbackPp); } catch (e) {}
            await sock.sendIAMessage(id, [
                {
                  name: "single_select",
                  buttonParamsJson: JSON.stringify({
                    title: "Select Here",
                    sections: [
                      {
                        title: "Menu",
                        rows: [
                          { title: "Menu", description: "Show bot menu", id: pf + "menu" },
                        ],
                      },
                    ],
                  }),
                },
              ], null, {
                header: text,
                footer: global.settings.footer || groupName,
                media: {
                  buffer: thumb,
                  name: action === "promote" ? pickRandom(dbTexts().promoteNames) || "Promoted" : pickRandom(dbTexts().demoteNames) || "Demoted",
                  address: action === "promote" ? pickRandom(dbTexts().promoteAddrs) : pickRandom(dbTexts().demoteAddrs),
                },
              mentions: [target],
            }).catch(() => {});
          }
          break;
      }
    } catch (e) {
      global.logError("whatsapp.participantsUpdate", e);
    }
  },
};
let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  delete require.cache[file];
});
