import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { discord as dcNs, md, texted, status } from "@kutashiakanocanzy/sdk";
import database from "../../database/index.js";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ActivityType } = dcNs.engine();
const ui = { rich: (src) => md(src) };
const fmt = { texted: (a, b) => texted(a, b), status: (k) => status(k) };

const floodMap = new Map;

async function handleAutomod(message) {
  try {
    if (!message.guild || message.author.bot) return;
    const db = database.get();
    const srv = db.discord && db.discord.servers && db.discord.servers[String(message.guild.id)];
    const a = srv && srv.settings && srv.settings.automod;
    if (!a || !a.enabled) return;
    const member = message.member;
    try {
      if (member && member.permissions && (member.permissions.has(8n) || member.permissions.has(32n))) return;
      if (member && Array.isArray(a.exempt) && member.roles && member.roles.cache && member.roles.cache.some(r => a.exempt.includes(r.id))) return;
    } catch (e) {}
    const text = String(message.content || "");
    const low = text.toLowerCase();
    let reason = "";
    if (Array.isArray(a.words) && a.words.length && low) {
      const hit = a.words.find(w => w && low.includes(String(w).toLowerCase()));
      if (hit) reason = "banned word: " + hit;
    }
    if (!reason && a.invites && /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/\S+/i.test(text)) reason = "invite link";
    if (!reason && a.floodMsgs > 0) {
      const key = String(message.guild.id) + ":" + String(message.author.id);
      const now = Date.now();
      const win = (a.floodSecs || 10) * 1000;
      const arr = (floodMap.get(key) || []).filter(t => now - t < win);
      arr.push(now);
      floodMap.set(key, arr);
      if (floodMap.size > 2000) floodMap.delete(floodMap.keys().next().value);
      if (arr.length > a.floodMsgs) reason = "flooding (" + arr.length + " in " + (a.floodSecs || 10) + "s)";
    }
    if (!reason && a.capsPct > 0 && text.length >= (a.capsLen || 20)) {
      const letters = text.replace(/[^A-Za-z]/g, "");
      if (letters.length >= (a.capsLen || 20)) {
        const upper = letters.replace(/[^A-Z]/g, "").length;
        if (upper / letters.length * 100 >= a.capsPct) reason = "excessive caps";
      }
    }
    if (!reason) return;
    try {
      const violator = db.discord.users[String(message.author.id)] || (db.discord.users[String(message.author.id)] = {});
      if (!violator.mod || typeof violator.mod !== "object") violator.mod = { warns: [], violations: 0, lastReason: "", lastAt: 0 };
      violator.mod.violations = (violator.mod.violations || 0) + 1;
      violator.mod.lastReason = reason;
      violator.mod.lastAt = Date.now();
      await database.write(db).catch(() => {});
    } catch (e) {}
    try { await message.delete().catch(() => {}); } catch (e) {}
    if (a.action === "timeout" && member) {
      try {
        const mins = Math.max(1, Math.min(1440, a.timeoutMin || 10));
        if (member.timeout) await member.timeout(mins * 60000, "Auto-mod: " + reason).catch(() => {});
      } catch (e) {}
    }
    if (a.log) {
      try {
        const ch = await message.guild.channels.fetch(a.log).catch(() => null);
        if (ch && ch.isTextBased()) {
          await ch.send({ embeds: [(new EmbedBuilder()).setColor("#ED4245").setTitle("Auto-mod Action").setDescription("User: <@" + message.author.id + ">\nChannel: <#" + message.channel.id + ">\nReason: " + reason + "\nAction: " + (a.action === "timeout" ? "delete + timeout" : "delete")).setTimestamp()] }).catch(() => {});
        }
      } catch (e) {}
    }
  } catch (e) {}
}

const MODULES = {
  rpg: "rpg",
  pokemon: "rpg",
  confess: "confess"
};

async function handleAiChat(message) {
  let tmp = null;
  try {
    await message.channel.sendTyping().catch(() => {});
    const gm = global.scraper && global.scraper.gemini;
    if (!gm) return;
    const pic = (message.attachments || new Map()).find(a => a && a.url && String(a.contentType || "").startsWith("image/"));
    let prompt = String(message.content || "").trim().slice(0, 1500);
    try {
      const refId = message.reference && message.reference.messageId;
      if (refId) {
        const ref = await message.channel.messages.fetch(refId).catch(() => null);
        if (ref) {
          const who = ref.author ? ref.author.username : "someone";
          const what = String(ref.content || "").trim().slice(0, 500);
          const refPic = ref.attachments && ref.attachments.some(a => a && a.url && String(a.contentType || "").startsWith("image/")) ? " [with an image]" : "";
          if (what || refPic) prompt = "[Replying to " + who + ": \"" + what + "\"" + refPic + "]\n" + prompt;
        }
      }
    } catch (e) {}
    let out = "";
    if (pic) {
      try {
        const r = await fetch(pic.url);
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length && buf.length <= 10000000 && typeof gm.chatWithImage === "function") {
          tmp = path.join(os.tmpdir(), "gemini-" + Date.now() + ".jpg");
          fs.writeFileSync(tmp, buf);
          const res = await gm.chatWithImage(prompt || "Describe this image in detail.", tmp, String(message.author.id));
          out = typeof res === "string" ? res : String((res && res.text) || "");
        }
      } catch (e) {}
      try { if (tmp) fs.unlinkSync(tmp); } catch (e) {}
    }
    if (!out) {
      if (!prompt) return;
      await gm.chat(prompt, String(message.author.id), c => { out += c; });
    }
    if (!out.trim()) return;
    const parts = [];
    let s = out;
    while (s.length > 1900) {
      parts.push(ui.rich(s.slice(0, 1900)));
      s = s.slice(1900);
    }
    parts.push(ui.rich(s));
    for (const p of parts) {
      await message.reply(p).catch(() => {});
    }
  } catch (e) {
    try { await message.reply("AI is busy right now. Try again soon.").catch(() => {}); } catch (e2) {}
  }
}

function moduleOf(cmd) {
  if (!cmd) return "tools";
  if (MODULES[cmd.name]) return MODULES[cmd.name];
  const cat = String(cmd.category || (cmd.tags && cmd.tags[0]) || "tools").toLowerCase();
  if (cat === "music" || cat === "images" || cat === "rpg") return cat;
  return "tools";
}

function serverSettings(db, gid, gname) {
  if (!db.discord || typeof db.discord !== "object") db.discord = {
    servers: {},
    users: {}
  };
  if (!db.discord.servers) db.discord.servers = {};
  if (!db.discord.servers[gid]) db.discord.servers[gid] = {
    id: gid,
    name: gname || "",
    createdAt: (new Date).toISOString()
  };
  const srv = db.discord.servers[gid];
  if (!srv.settings || typeof srv.settings !== "object") srv.settings = {};
  if (!srv.settings.modules || typeof srv.settings.modules !== "object") srv.settings.modules = {};
  const defs = {
    rpg: true,
    confess: true,
    music: true,
    images: true,
    tools: true
  };
  for (const k of Object.keys(defs)) if (srv.settings.modules[k] === undefined) srv.settings.modules[k] = defs[k];
  if (!Array.isArray(srv.settings.disabled)) srv.settings.disabled = [];
  if (!srv.settings.channels || typeof srv.settings.channels !== "object") srv.settings.channels = {};
  return srv.settings;
}

function gateCheck(db, gid, channelId, userId, cmd) {
  if (!gid) return null;
  const always = ["config", "help", "register", "unregister"];
  if (cmd && always.includes(cmd.name)) return null;
  const st = serverSettings(db, gid);
  const mod = moduleOf(cmd);
  try {
    const owners = [].concat(global.settings?.discord?.owner || global.dcOwner || []);
    if (owners.includes(String(userId))) return null;
  } catch (e) {}
  if (st.modules && st.modules[mod] === false) return {
    message: "The " + mod + " module is turned OFF in this server. Staff can enable it with /config."
  };
  const nm = cmd.name;
  if (Array.isArray(st.disabled) && st.disabled.includes(nm) && !always.includes(nm)) return {
    message: "The /" + nm + " command is disabled in this server."
  };
  const allow = st.channels && st.channels[mod];
  if (Array.isArray(allow) && allow.length && channelId && !allow.includes(String(channelId))) return {
    message: "Use " + allow.map(x => "<#" + x + ">").join(" ") + " for " + mod + " commands."
  };
  return null;
}

function gateByModule(db, gid, channelId, userId, modName) {
  if (!gid) return null;
  const st = serverSettings(db, gid);
  try {
    const owners = [].concat(global.settings?.discord?.owner || global.dcOwner || []);
    if (owners.includes(String(userId))) return null;
  } catch (e) {}
  if (st.modules && st.modules[modName] === false) return {
    message: "The " + modName + " module is turned OFF in this server. Staff can enable it with /config."
  };
  const allow = st.channels && st.channels[modName];
  if (Array.isArray(allow) && allow.length && channelId && !allow.includes(String(channelId))) return {
    message: "Use " + allow.map(x => "<#" + x + ">").join(" ") + " for " + modName + " commands."
  };
  return null;
}

export default {
  setup(client) {
    client.once("clientReady", async () => {
      try {
        global.discord = client;
        const commandsData = Object.values(global.discordCommands).filter(cmd => cmd && cmd.name && cmd.execute && Array.isArray(cmd.options)).map(cmd => {
          const d = {
            name: cmd.name,
            description: cmd.description,
            options: cmd.options || []
          };
          if (cmd["default_member_permissions"] !== undefined) d["default_member_permissions"] = cmd["default_member_permissions"];
          return d;
        });
        if (commandsData.length > 0) {
          let changed = true;
          try {
            const hashFile = path.join(process.cwd(), "system", "database", "dashboard", "discord-commands.hash");
            const hash = crypto.createHash("sha1").update(JSON.stringify(commandsData)).digest("hex");
            try {
              if (fs.existsSync(hashFile) && fs.readFileSync(hashFile, "utf8").trim() === hash) changed = false;
            } catch (e) {}
            if (changed) {
              await client.application.commands.set(commandsData);
              try { fs.mkdirSync(path.dirname(hashFile), { recursive: true }); } catch (e) {}
              try { fs.writeFileSync(hashFile, hash); } catch (e) {}
            }
          } catch (e) {
            await client.application.commands.set(commandsData);
          }
          if (!changed) {
            try { console.log("[DC] commands unchanged, register skipped"); } catch (e) {}
          }
        }
        try {
          const { default: engine } = await import("./plugins/music/engine.js");
          await engine.rstSessions(client);
        } catch (e) {
          global.logError("discord.rstSessions", e);
        }
        for (const cmd of Object.values(global.discordCommands)) {
          if (cmd && typeof cmd.setup === "function") {
            try {
              await cmd.setup(client);
            } catch (e) {
              global.logError("discord.pluginSetup." + (cmd.name || "?"), e);
            }
          }
        }
        const db = database.get();
        const presence = db.settings?.discord?.presence || {};
        global.discord.user.setPresence({
          activities: [ {
            name: presence.name || global.settings?.discord?.presence?.name || global.botname,
            type: ActivityType[presence.type || global.settings?.discord?.presence?.type || "Custom"],
            state: presence.state || global.settings?.discord?.presence?.state || "Bot Active"
          } ],
          status: presence.status || global.settings?.discord?.presence?.status || "online"
        });
        try {
          const chalk = (await import("chalk")).default;
          console.log(chalk.hex("#5865F2")(`[DC] ✓ Connected ${client.user.tag} (${client.guilds.cache.size} servers)`));
        } catch {}
      } catch (error) {
        global.logError("discord.clientReady", error);
      }
    });
    client.on("interactionCreate", async interaction => {
      try {
        fs.appendFileSync(process.env.HOME + "/.akano-debughandler.log", JSON.stringify({
          ts: (new Date).toISOString(),
          uid: interaction.user?.id || null,
          type: interaction.type,
          name: interaction.commandName || null,
          isChat: interaction.isChatInputCommand(),
          found: !!global.discordCommands[interaction.commandName || ""]
        }) + "\n");
      } catch {}
      try {
        await (await import("../print.js")).default({
          type: "discord",
          interaction: interaction
        });
      } catch (e) {}
      if (interaction.isAutocomplete()) {
        const command = global.discordCommands[interaction.commandName];
        const focused = interaction.options.getFocused(true);
        if (command && typeof command.autocomplete === "function") {
          try {
            await command.autocomplete(interaction, focused);
          } catch (e) {
            try {
              await interaction.respond([]);
            } catch {}
          }
          return;
        }
        if (interaction.commandName === "p" && focused.name === "query") {
          try {
            const q = String(focused.value || "").trim();
            if (!q) {
              await interaction.respond([]).catch(() => {});
              return;
            }
            const uid = interaction.user.id;
            let session = null;
            try {
              const { default: ysMod } = await import("../../../scrapers/src/ytsession.js");
              const ys = ysMod || {};
              if (ys.has(uid)) session = await ys.getSession(uid);
            } catch {}
            let suggestions = [];
            try {
              const ytm = global.scraper?.ytmusic;
              if (ytm && typeof ytm.searchSuggestions === "function") {
                suggestions = await ytm.searchSuggestions(q, 8);
              }
            } catch {}
            if (!suggestions.length) {
              try {
                const ytm = global.scraper?.ytmusic;
                const s = session;
                const hits = await ytm.searchType(q, "song", 5, s).catch(() => []);
                suggestions = hits.map(h => `${h.title} — ${h.artist}`);
              } catch {}
            }
            const choices = suggestions.slice(0, 25).map(s => ({
              name: String(s).slice(0, 100),
              value: String(s).slice(0, 100)
            }));
            await interaction.respond(choices).catch(() => {});
          } catch {
            try {
              await interaction.respond([]);
            } catch {}
          }
          return;
        }
        try {
          await interaction.respond([]);
        } catch {}
        return;
      }
      if (interaction.isChatInputCommand()) {
        const command = global.discordCommands[interaction.commandName];
        if (!command) return;
        if (!global.coolCache) global.coolCache = new Map;
        if (!global.limCache) global.limCache = new Map;
        const isExempt = [ "settings", "status" ].includes(command.name);
        if (interaction.guildId && interaction.user) {
          const uid = interaction.user.id;
          const today = (new Date).toISOString().slice(0, 10);
          if (!isExempt) {
            const db = database.get();
            const banned = db.discord?.users?.[uid]?.banned;
            if (banned) {
              await interaction.reply({
                content: "You have been banned for violating bot rules!",
                flags: 64
              }).catch(() => {});
              return;
            }
            const dayLimit = global.settings?.discord?.dailyLimit || 200;
            const bucket = global.limCache.get(uid);
            if (!bucket || bucket.day !== today) {
              global.limCache.set(uid, {
                day: today,
                count: 0
              });
            }
            const usage = global.limCache.get(uid);
            if (usage.count >= dayLimit) {
              await interaction.reply({
                content: "You have reached your daily command limit. Try again tomorrow!",
                flags: 64
              }).catch(() => {});
              return;
            }
            const cooldownKey = uid + ":" + command.name;
            const last = global.coolCache.get(cooldownKey) || 0;
            if (Date.now() - last < 3e3) {
              await interaction.reply({
                content: "Slow down! Please wait a moment before using this command again.",
                flags: 64
              }).catch(() => {});
              return;
            }
            global.coolCache.set(cooldownKey, Date.now());
            usage.count += 1;
          }
        }
        try {
          const db = database.get();
          const disabled = db.settings?.disabledPlugins?.discord || [];
          if (disabled.includes(command.name)) {
            await interaction.reply({
              content: "Sorry, this feature is currently disabled due to an error!",
              flags: 64
            }).catch(() => {});
            return;
          }
        } catch (e) {}
        const g = gateCheck(database.get(), interaction.guildId, interaction.channelId, interaction.user && interaction.user.id, command);
        if (g) {
          await interaction.reply({
            content: g.message,
            flags: 64
          }).catch(() => {});
          return;
        }
        const dcUserId = interaction.user?.id || "";
        const isDC = global.settings?.discord?.owner || global.dcOwner || [];
        const isDCOwner = isDC.includes(dcUserId);
        const isDCPrem = (() => {
          try {
            const db = database.get();
            if (isDCOwner) return true;
            return !!db.discord?.users?.[dcUserId]?.premium;
          } catch {
            return false;
          }
        })();
        const isDCAdmin = (() => {
          const perms = interaction.memberPermissions;
          if (perms) return perms.has(8n);
          try {
            return interaction.member?.permissions?.has(8n) || false;
          } catch {
            return false;
          }
        })();
        const gateFail = command.owner ? !isDCOwner : command.premium ? !isDCPrem : command.admin ? !isDCAdmin : null;
        if (gateFail) {
          const key = command.owner ? "owner" : command.premium ? "premium" : "admin";
          await interaction.reply({
            content: fmt.texted("bold", fmt.status(key)),
            flags: 64
          }).catch(() => {});
          return;
        }
        if (typeof command.cooldown === "number" && command.cooldown > 0 && !isDCOwner) {
          const key = dcUserId + ":" + command.name;
          const last = global.coolCache.get(key) || 0;
          if (Date.now() - last < command.cooldown) {
            await interaction.reply({
              content: fmt.texted("bold", fmt.status("cooldown")),
              flags: 64
            }).catch(() => {});
            return;
          }
          global.coolCache.set(key, Date.now());
        }
        if (interaction.guildId && !client.guilds.cache.has(interaction.guildId)) {
          const inviteLink = `https://discord.com/oauth2/authorize?client_id=${client.user.id}&permissions=8&scope=bot+applications.commands`;
          const embed = (new EmbedBuilder).setColor("#5865F2").setTitle("I'm not in this server yet").setDescription("It looks like **" + global.botname + "** has not officially joined this server.\n\nClick the button below to add me, then use the command again!").addFields({
            name: "Permissions",
            value: "Administrator (semua fitur: musik, moderasi, images)",
            inline: true
          }, {
            name: "Scope",
            value: "`bot` + `applications.commands`",
            inline: true
          }).setThumbnail("https://cdn-icons-png.flaticon.com/128/3462/3462381.png").setFooter({
            text: global.botname
          }).setTimestamp();
          const row = (new ActionRowBuilder).addComponents((new ButtonBuilder).setLabel("Invite Bot to Server").setStyle(ButtonStyle.Link).setURL(inviteLink));
          try {
            await interaction.reply({
              embeds: [ embed ],
              components: [ row ],
              flags: 64
            });
          } catch (e) {
            global.logError("discord.inviteReply", e);
          }
          return;
        }
        if (global.settings?.maintenance && !isDCOwner) {
          await interaction.reply({
            content: "🛠️ Bot is under maintenance. Try again soon!",
            flags: 64
          }).catch(() => {});
          return;
        }
        try {
          interaction._receivedAt = Date.now();
          if (interaction.guildId) {
            try {
              const db = database.get();
              const existed = !!db.discord?.servers?.[interaction.guildId];
              database.ensureDiscord(db, interaction);
              if (!existed) database.write(db);
            } catch (e) {
              global.logError("discord.database", e);
            }
          }
          if (typeof command.before === "function") {
            try {
              const stop = await command.before(interaction, {
                budy: interaction.options?.getString?.("query") || ""
              });
              if (stop === true) return;
            } catch (e) {
              global.logError("discord.before", e);
            }
          }
          await command.execute(interaction);
        } catch (error) {
          const db = database.get();
          if (!db.settings) db.settings = {};
          if (!db.settings.pluginErrors) db.settings.pluginErrors = {
            telegram: {},
            discord: {}
          };
          if (!db.settings.pluginErrors.discord[command.name]) db.settings.pluginErrors.discord[command.name] = 0;
          db.settings.pluginErrors.discord[command.name] += 1;
          global.logError("discord.plugin", error);
          if (db.settings.pluginErrors.discord[command.name] >= 5) {
            delete global.discordCommands[command.name];
            if (!db.settings.disabledPlugins) db.settings.disabledPlugins = {
              telegram: [],
              discord: []
            };
            if (!db.settings.disabledPlugins.discord.includes(command.name)) {
              db.settings.disabledPlugins.discord.push(command.name);
            }
          }
          database.write(db);
          try {
            await interaction.reply({
              content: "Sorry, an error occurred while running this feature. Please try again later!",
              flags: 64
            });
          } catch (e) {
            await interaction.followUp({
              content: "Sorry, an error occurred while running this feature. Please try again later!",
              flags: 64
            }).catch(() => {});
          }
          return;
        }
        return;
      }
      if (interaction.isButton()) {
        const customId = String(interaction.customId || "");
        if (customId.startsWith("cf_")) {
          const gb = gateByModule(database.get(), interaction.guildId, interaction.channelId, interaction.user && interaction.user.id, "confess");
          if (gb) {
            await interaction.reply({
              content: gb.message,
              flags: 64
            }).catch(() => {});
            return;
          }
          const cfCmd = global.discordCommands["confess"];
          if (cfCmd && typeof cfCmd.handleComponent === "function") {
            try {
              await cfCmd.handleComponent(interaction);
            } catch (error) {
              global.logError("discord.confess.button", error);
            }
          }
          return;
        }
        if (customId.startsWith("lb|")) {
          const libCmd = global.discordCommands["lib"];
          if (libCmd && typeof libCmd.handleComponent === "function") {
            try {
              await libCmd.handleComponent(interaction);
            } catch (error) {
              global.logError("discord.lib.button", error);
            }
          }
          return;
        }
        const MUSIC_PREFIXES = [ "music_", "seek_", "volume_", "filter_", "genre_" ];
        if (customId.startsWith("rpg_")) {
          const gbR = gateByModule(database.get(), interaction.guildId, interaction.channelId, interaction.user && interaction.user.id, "rpg");
          if (gbR) {
            await interaction.reply({
              content: gbR.message,
              flags: 64
            }).catch(() => {});
            return;
          }
          return;
        }
        if (!MUSIC_PREFIXES.some(p => customId.startsWith(p))) {
          return;
        }
        const gbM = gateByModule(database.get(), interaction.guildId, interaction.channelId, interaction.user && interaction.user.id, "music");
        if (gbM) {
          await interaction.reply({
            content: gbM.message,
            flags: 64
          }).catch(() => {});
          return;
        }
        const playCmd = global.discordCommands["p"];
        if (playCmd && typeof playCmd.handleButton === "function") {
          try {
            await playCmd.handleButton(interaction);
          } catch (error) {
            global.logError("discord.button", error);
          }
        }
        return;
      }
      if (interaction.isModalSubmit && interaction.isModalSubmit()) {
        const customId = String(interaction.customId || "");
        if (customId.startsWith("cf_")) {
          const gb = gateByModule(database.get(), interaction.guildId, interaction.channelId, interaction.user && interaction.user.id, "confess");
          if (gb) {
            await interaction.reply({
              content: gb.message,
              flags: 64
            }).catch(() => {});
            return;
          }
          const cfCmd = global.discordCommands["confess"];
          if (cfCmd && typeof cfCmd.handleModal === "function") {
            try {
              await cfCmd.handleModal(interaction);
            } catch (error) {
              global.logError("discord.confess.modal", error);
            }
          }
          return;
        }
      }
      if (interaction.isStringSelectMenu()) {
        const sid = String(interaction.customId || "");
        if (sid.startsWith("music_dash_addpl_pick:")) {
          try {
            const { default: engine } = await import("./plugins/music/engine.js");
            const q = engine.queues.get(interaction.guildId);
            const fakeQ = q || {
              textChannel: interaction.channel,
              client: interaction.client,
              songs: [],
              currentSong: null,
              volume: 1,
              loop: "off",
              autoplay: false,
              _dashboardNoQueue: true
            };
            const targetQ = q || fakeQ;
            await engine.onMusicBtn(targetQ, interaction.guildId, interaction, interaction.message);
          } catch (e) {
            try {
              global.logError("discord.dashboard.select", e);
            } catch {}
          }
          return;
        }
        const userId = String(interaction.user.id);
        if (interaction.customId === "regAgeSel") {
          const val = interaction.values?.[0];
          const age = val === "random" ? 9 + Math.floor(Math.random() * 22) : parseInt(val, 10);
          if (!isNaN(age) && age >= 5 && age <= 30) {
            const data = database.get();
            if (!data.discord) data.discord = {};
            if (!data.discord.users) data.discord.users = {};
            if (!data.discord.users[userId]) data.discord.users[userId] = {};
            Object.assign(data.discord.users[userId], {
              age: age,
              registered: true,
              regTime: Date.now()
            });
            database.write(data);
            await interaction.reply({
              content: `Registered successfully!\n\nName: ${interaction.user.username}\nAge: ${age} years`,
              flags: 64
            }).catch(() => {});
          }
          return;
        }
      }
    });
    client.on("messageCreate", async message => {
      if (message.author?.bot) return;
      try {
        await (await import("../print.js")).default({
          type: "discord",
          message: message
        });
      } catch (e) {}
      if (!message.guild && message.channel?.type === 1) {
        try {
          const data = database.get();
          const user = data?.discord?.users?.[String(message.author.id)];
          if (!user?.registered) {
            if (!global.promptCache) global.promptCache = new Map;
            const key = String(message.author.id);
            const last = global.promptCache.get(key) || 0;
            if (Date.now() - last < 6 * 3600 * 1e3) return;
            global.promptCache.set(key, Date.now());
            const { ActionRowBuilder: ActionRowBuilder, StringSelectMenuBuilder: StringSelectMenuBuilder } = dcNs.engine();
            const ageSelect = (new StringSelectMenuBuilder).setCustomId("regAgeSel").setPlaceholder("Select Your Age").addOptions([ {
              label: "Random Years",
              value: "random"
            }, ...Array.from({
              length: 22
            }, (_, i) => 30 - i).map(a => ({
              label: `${a} Years`,
              value: String(a)
            })) ]);
            message.reply({
              content: "Select Your Age",
              components: [ (new ActionRowBuilder).addComponents(ageSelect) ]
            }).catch(() => {});
          }
        } catch (e) {}
      }
      if (message.guild && !message.author?.bot) {
        try {
          const text = String(message.content || "").trim();
          const hasPic = !!(message.attachments && message.attachments.some(a => a && a.url && String(a.contentType || "").startsWith("image/")));
          const isReply = !!(message.reference && message.reference.messageId);
          if ((text || hasPic || isReply) && !text.startsWith("/") && !text.startsWith("!")) {
            const db = database.get();
            const chans = db.discord?.servers?.[String(message.guild.id)]?.settings?.aiChannels;
            if (Array.isArray(chans) && chans.includes(String(message.channel.id))) {
              const g = gateCheck(db, String(message.guild.id), String(message.channel.id), String(message.author.id), { name: "gemini", category: "tools" });
              const gm = global.scraper && global.scraper.gemini;
              if (!g && gm) {
                if (!global.aichatCd) global.aichatCd = new Map;
                const ck = "aichat:" + String(message.author.id);
                if (Date.now() - (global.aichatCd.get(ck) || 0) >= 3000) {
                  global.aichatCd.set(ck, Date.now());
                  handleAiChat(message).catch(() => {});
                }
              }
            }
          }
        } catch (e) {}
      }
      handleAutomod(message).catch(() => {});
    });
  }
};