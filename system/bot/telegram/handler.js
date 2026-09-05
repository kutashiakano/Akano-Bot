const database = require("../../database");
const logger = require("./logger");
const groupManager = require("./group-manager");
const moment = require("moment-timezone");
const fmt = require("../format");

const floodCache = new Map;

async function _getAvatarUrl(userId) {
  try {
    const tg = require("./index");
    if (typeof tg.getAvatarUrl === "function") return tg.getAvatarUrl(userId);
  } catch {}
  return null;
}

function buildUserInfo(fromUser) {
  if (!fromUser) return {};
  return {
    id: String(fromUser.id || ""),
    first_name: fromUser.first_name || null,
    last_name: fromUser.last_name || null,
    username: fromUser.username || null,
    language_code: fromUser.language_code || null,
    is_bot: fromUser.is_bot || false
  };
}

async function isAdmin(ctx, userId) {
  if (!userId) return false;
  try {
    const m = await ctx.api.getChatMember(ctx.chat.id, userId);
    return m && (m.status === "administrator" || m.status === "creator");
  } catch {
    return false;
  }
}

const FULL_PERMISSIONS = {
  can_send_messages: true,
  can_send_media_messages: true,
  can_send_audios: true,
  can_send_documents: true,
  can_send_photos: true,
  can_send_videos: true,
  can_send_video_notes: true,
  can_send_voice_notes: true,
  can_send_polls: true,
  can_send_other_messages: true,
  can_add_web_page_previews: true,
  can_change_info: true,
  can_invite_users: true,
  can_pin_messages: true,
  can_manage_topics: true,
  can_react_to_messages: true,
  can_edit_tag: true
};

const handler = {
  setup(bot) {
    bot.on("message", async ctx => {
      const msg = ctx.message || ctx.msg;
      if (!msg) return;
      ctx._receivedAt = Date.now();
      try {
        require("../print")({
          type: "telegram",
          ctx: ctx
        });
      } catch {}
      try {
        if (typeof global.__botEvent === "function") {
          const fromUser = ctx.from;
          const senderId = String(fromUser?.id || "");
          const pushName = [ fromUser?.first_name, fromUser?.last_name ].filter(Boolean).join(" ") || fromUser?.username || "Telegram User";
          _getAvatarUrl(fromUser?.id).then(avatarUrl => {
            global.__botEvent({
              type: "message",
              data: {
                platform: "telegram",
                chatId: String(ctx.chat.id),
                chatName: ctx.chat.title || pushName,
                from: senderId,
                pushName: pushName,
                user: buildUserInfo(fromUser),
                username: fromUser?.username || null,
                avatarUrl: avatarUrl || null,
                text: msg.text || msg.caption || "",
                isGroup: ctx.chat.type === "group" || ctx.chat.type === "supergroup",
                isCommand: !!(msg.text && msg.text.startsWith("/")),
                command: msg.text?.match(/^\/(\w+)/)?.[1] || null,
                messageId: msg.message_id,
                timestamp: (msg.date || Math.floor(Date.now() / 1e3)) * 1e3
              }
            });
          }).catch(() => {});
        }
      } catch {}
      if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
        const db = database.get();
        database.ensureTelegram(db, ctx);
        database.write(db);
        const group = db.telegram.groups[ctx.chat.id] || {};
        const isUserAdmin = await isAdmin(ctx, ctx.from?.id);
        if (!isUserAdmin) {
          const msgText = msg.text || "";
          if (group.antispam && msgText && /https?:\/\/[^\s]+/gi.test(msgText)) {
            await ctx.api.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
            return;
          }
          if (group.antiarab) {
            const isArab = /[\u0600-\u06FF]/i.test(msgText) || /[\u0600-\u06FF]/i.test(ctx.from?.first_name || "");
            if (isArab) {
              await ctx.api.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
              await ctx.api.banChatMember(ctx.chat.id, ctx.from.id).catch(() => {});
              await ctx.api.unbanChatMember(ctx.chat.id, ctx.from.id).catch(() => {});
              return;
            }
          }
          if (group.antitagall && msgText && (msgText.includes("@all") || msgText.includes("@everyone"))) {
            await ctx.api.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
            return;
          }
          if (group.antiflood && ctx.from) {
            const userId = ctx.from.id;
            const now = Date.now();
            if (!floodCache.has(userId)) floodCache.set(userId, []);
            const ts = floodCache.get(userId);
            ts.push(now);
            const active = ts.filter(t => now - t < 5e3);
            floodCache.set(userId, active);
            if (active.length > 5) {
              await ctx.api.restrictChatMember(ctx.chat.id, userId, {
                permissions: {
                  can_send_messages: false
                }
              }).catch(() => {});
              await ctx.reply(global.settings.message.muteSuccess.replace("{name}", ctx.from.first_name)).catch(() => {});
              return;
            }
          }
          if (group.verification && msgText === "Verify") {
            await ctx.api.restrictChatMember(ctx.chat.id, ctx.from.id, {
              permissions: FULL_PERMISSIONS,
              until_date: 0
            }).catch(() => {});
            return ctx.reply("Verification successful. You can now chat.", {
              reply_markup: {
                remove_keyboard: true
              }
            }).catch(() => {});
          }
        }
      }
      for (const name in global.telegramPlugins) {
        const pl = global.telegramPlugins[name];
        if (pl && typeof pl.before === "function") {
          try {
            const stop = await pl.before(ctx, {
              budy: msg.text || ""
            });
            if (stop === true) return;
          } catch (e) {
            global.logError("telegram.before", e);
          }
        }
      }
      const text = msg.text || "";
      if (!text) return;
      const match = text.match(/^\/(\w+)(?:\s+(.+))?/);
      if (!match) return;
      const command = match[1].toLowerCase();
      const args = match[2] || "";
      logger.cmd(ctx, command, args);
      let plugin = global.telegramPlugins[command];
      if (!plugin) {
        plugin = Object.values(global.telegramPlugins).find(p => {
          if (Array.isArray(p.command)) return p.command.filter(c => typeof c === "string").map(c => c.toLowerCase()).includes(command);
          if (typeof p.command === "string") return p.command.toLowerCase() === command;
          return false;
        });
      }
      if (!plugin && command) {
        const all = Object.values(global.telegramPlugins).flatMap(p => (Array.isArray(p.command) ? p.command : [ p.command ]).filter(c => typeof c === "string")).map(c => String(c).toLowerCase());
        const sgs = fmt.matcher(command, all).slice(0, 3);
        if (sgs.length) {
          const caption = fmt.texted("bold", "Command not found.") + " Did you mean:\n\n" + sgs.map((v, i) => `*${i + 1}.* /${v.string} (${v.accuracy}%)`).join("\n");
          return await ctx.reply(caption).catch(() => {});
        }
      }
      try {
        const dbDisabled = database.get().settings?.disabledPlugins?.telegram || [];
        if (dbDisabled.includes(command)) return ctx.reply(global.settings.message.errorF).catch(() => {});
      } catch {}
      if (plugin && typeof plugin.run === "function") {
        const uid = String(ctx.from?.id || "");
        const isOwner = (global.settings?.telegram?.owner || global.tgOwner || []).includes(uid) || global.owner.map(o => o.replace(/[^\d]/g, "")).includes(uid);
        const inGroup = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
        const dbNow = database.get();
        const isPrem = !!dbNow?.telegram?.users?.[uid]?.premium;
        if (plugin.owner && !isOwner) return ctx.reply(fmt.texted("bold", fmt.status("owner"))).catch(() => {});
        if (plugin.private && inGroup) return ctx.reply(fmt.texted("bold", fmt.status("private"))).catch(() => {});
        if (plugin.group && !inGroup) return ctx.reply(fmt.texted("bold", fmt.status("group"))).catch(() => {});
        if (plugin.admin && !await isAdmin(ctx, ctx.from?.id)) return ctx.reply(fmt.texted("bold", fmt.status("admin"))).catch(() => {});
        if (plugin.premium && !isPrem && !isOwner) return ctx.reply(fmt.texted("bold", fmt.status("premium"))).catch(() => {});
        if (global.settings?.maintenance && !(global.tgOwner || []).includes(String(ctx.from?.id))) return ctx.reply("🛠️ Bot is under maintenance. Try again soon!").catch(() => {});
        try {
          if (global.settings?.telegram?.autoTyping) await ctx.api.sendChatAction(ctx.chat.id, "typing").catch(() => {});
          await plugin.run(ctx, args);
        } catch (error) {
          const pName = command;
          const db = database.get();
          if (!db.settings) db.settings = {};
          if (!db.settings.pluginErrors) db.settings.pluginErrors = {
            telegram: {},
            discord: {}
          };
          if (!db.settings.pluginErrors.telegram[pName]) db.settings.pluginErrors.telegram[pName] = 0;
          db.settings.pluginErrors.telegram[pName] += 1;
          global.logError("telegram.plugin", error);
          if (db.settings.pluginErrors.telegram[pName] >= 5) {
            delete global.telegramPlugins[pName];
            if (!db.settings.disabledPlugins) db.settings.disabledPlugins = {
              telegram: [],
              discord: []
            };
            if (!db.settings.disabledPlugins.telegram.includes(pName)) db.settings.disabledPlugins.telegram.push(pName);
          }
          database.write(db);
          ctx.reply(global.settings.message.error).catch(() => {});
        }
      }
    });
    bot.on("inline_query", async ctx => {
      for (const name in global.telegramPlugins) {
        const pl = global.telegramPlugins[name];
        if (pl && typeof pl.before === "function") {
          try {
            const stop = await pl.before(ctx, {
              budy: ctx.inlineQuery?.query || ""
            });
            if (stop === true) return;
          } catch (e) {
            global.logError("telegram.inline", e);
          }
        }
      }
      await ctx.api.answerInlineQuery(ctx.inlineQuery.id, [], {
        cache_time: 0
      }).catch(() => {});
    });
    bot.on("edited_message", async ctx => {
      try {
        if (typeof global.__botEvent === "function") {
          const msg = ctx.editedMessage || ctx.update?.edited_message;
          if (!msg) return;
          const fromUser = msg.from || ctx.from;
          const senderId = String(fromUser?.id || "");
          const pushName = [ fromUser?.first_name, fromUser?.last_name ].filter(Boolean).join(" ") || fromUser?.username || "Telegram User";
          _getAvatarUrl(fromUser?.id).then(avatarUrl => {
            global.__botEvent({
              type: "edit",
              data: {
                platform: "telegram",
                chatId: String(ctx.chat?.id ?? msg.chat?.id),
                chatName: ctx.chat?.title || msg.chat?.title || pushName,
                from: senderId,
                pushName: pushName,
                user: buildUserInfo(fromUser),
                username: fromUser?.username || null,
                avatarUrl: avatarUrl || null,
                text: msg.text || msg.caption || "",
                isGroup: (ctx.chat?.type || msg.chat?.type) === "group" || (ctx.chat?.type || msg.chat?.type) === "supergroup",
                messageId: msg.message_id,
                timestamp: (msg.edit_date || msg.date || Math.floor(Date.now() / 1e3)) * 1e3
              }
            });
          }).catch(() => {});
        }
      } catch {}
    });
    bot.on("my_chat_member", async ctx => {
      const upd = ctx.myChatMember || ctx.update?.my_chat_member;
      const status = upd?.new_chat_member?.status;
      if (status === "member" || status === "administrator") {
        try {
          await groupManager.handleJoinGroup(ctx);
        } catch (e) {
          global.logError("telegram.groupJoin", e);
        }
      }
    });
    bot.on("message:new_chat_members", async ctx => {
      try {
        const groupId = ctx.chat.id;
        const db = database.get();
        const groupSettings = db.telegram.groups?.[groupId] || {};
        const newMembers = ctx.message.new_chat_members || ctx.msg?.new_chat_members;
        for (const member of newMembers || []) {
          if (member.is_bot) continue;
          if (groupSettings.autoGreeting) {
            const firstName = member.first_name || "Member";
            const username = member.username ? `@${member.username}` : "N/A";
            const memberId = member.id;
            const time = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");
            const welcomeText = groupSettings.welcomeText || `<b>Welcome to the Group!</b>\n──────────────────────\nName: ${firstName}\nUsername: ${username}\nUser ID: <code>${memberId}</code>\nTime: ${time}\n──────────────────────\n<i>Enjoy your stay and follow the rules!</i>`;
            try {
              await ctx.api.sendPhoto(groupId, global.settings.cover, {
                caption: welcomeText,
                parse_mode: "HTML"
              });
            } catch {
              await ctx.reply(welcomeText, {
                parse_mode: "HTML"
              }).catch(() => {});
            }
          }
          if (groupSettings.verification) {
            await ctx.api.restrictChatMember(groupId, member.id, {
              permissions: {
                can_send_messages: false,
                can_send_media_messages: false,
                can_send_audios: false,
                can_send_documents: false,
                can_send_photos: false,
                can_send_videos: false,
                can_send_video_notes: false,
                can_send_voice_notes: false,
                can_send_polls: false,
                can_send_other_messages: false,
                can_add_web_page_previews: false,
                can_change_info: false,
                can_invite_users: false,
                can_pin_messages: false
              }
            }).catch(() => {});
            const verifyText = (groupSettings.verificationText || `Welcome <b>%member%</b>. Please press the Verify button to start chatting.`).replace("%member%", member.first_name || "Member");
            await ctx.reply(verifyText, {
              parse_mode: "HTML",
              reply_markup: {
                keyboard: [ [ {
                  text: "Verify"
                } ] ],
                one_time_keyboard: true,
                resize_keyboard: true
              }
            }).catch(() => {});
          }
        }
      } catch (e) {
        global.logError("telegram.newMembers", e);
      }
    });
    bot.on("message:left_chat_member", async ctx => {
      try {
        const groupId = ctx.chat.id;
        const db = database.get();
        const groupSettings = db.telegram.groups?.[groupId] || {};
        if (groupSettings.goodbyeMessage) {
          const member = ctx.message.left_chat_member || ctx.msg?.left_chat_member;
          const firstName = member?.first_name || "Member";
          const goodbyeText = groupSettings.goodbyeText || `${firstName} has left the group.`;
          await ctx.reply(goodbyeText, {
            parse_mode: "HTML"
          }).catch(() => {});
        }
      } catch (e) {
        global.logError("telegram.leftMember", e);
      }
    });
    bot.on("callback_query:data", async ctx => {
      const data = ctx.callbackQuery.data;
      try {
        if (typeof global.__botEvent === "function") {
          const fromUser = ctx.from;
          const senderId = String(fromUser?.id || "");
          const pushName = [ fromUser?.first_name, fromUser?.last_name ].filter(Boolean).join(" ") || fromUser?.username || "Telegram User";
          _getAvatarUrl(fromUser?.id).then(avatarUrl => {
            global.__botEvent({
              type: "callback_query",
              data: {
                platform: "telegram",
                chatId: String(ctx.chat?.id || ctx.callbackQuery.message?.chat?.id || ""),
                chatName: ctx.chat?.title || ctx.callbackQuery.message?.chat?.title || pushName,
                from: senderId,
                pushName: pushName,
                user: buildUserInfo(fromUser),
                username: fromUser?.username || null,
                avatarUrl: avatarUrl || null,
                callbackData: data || null,
                messageId: ctx.callbackQuery.message?.message_id || null,
                timestamp: Date.now()
              }
            });
          }).catch(() => {});
        }
      } catch {}
      if (data && data.startsWith("menu:")) {
        const menuPlugin = global.telegramPlugins["menu"];
        if (menuPlugin && typeof menuPlugin.onCallback === "function") {
          try {
            await menuPlugin.onCallback(ctx);
          } catch (e) {
            global.logError("telegram.menuCallback", e);
          }
        }
      } else if (data && data.startsWith("idl:")) {
        const dlInline = global.telegramPlugins["inline"];
        if (dlInline && typeof dlInline.onCallback === "function") {
          try {
            await dlInline.onCallback(ctx);
          } catch (e) {
            global.logError("telegram.inlineDownloader", e);
          }
        }
      } else if (data && (data.startsWith("reglang:") || data.startsWith("age:"))) {
        const regPlugin = global.telegramPlugins["register"];
        if (regPlugin && typeof regPlugin.onCallback === "function") {
          try {
            await regPlugin.onCallback(ctx);
          } catch (e) {
            global.logError("telegram.registerCallback", e);
          }
        }
      }
      await ctx.api.answerCallbackQuery(ctx.callbackQuery.id).catch(() => {});
    });
    bot.on("callback_query", async ctx => {
      if (ctx.callbackQuery?.data) return;
      try {
        if (typeof global.__botEvent === "function") {
          const fromUser = ctx.from;
          const senderId = String(fromUser?.id || "");
          const pushName = [ fromUser?.first_name, fromUser?.last_name ].filter(Boolean).join(" ") || fromUser?.username || "Telegram User";
          _getAvatarUrl(fromUser?.id).then(avatarUrl => {
            global.__botEvent({
              type: "callback_query",
              data: {
                platform: "telegram",
                chatId: String(ctx.chat?.id || ctx.callbackQuery.message?.chat?.id || ""),
                chatName: ctx.chat?.title || ctx.callbackQuery.message?.chat?.title || pushName,
                from: senderId,
                pushName: pushName,
                user: buildUserInfo(fromUser),
                username: fromUser?.username || null,
                avatarUrl: avatarUrl || null,
                callbackData: null,
                messageId: ctx.callbackQuery.message?.message_id || null,
                timestamp: Date.now()
              }
            });
          }).catch(() => {});
        }
      } catch {}
      await ctx.api.answerCallbackQuery(ctx.callbackQuery.id).catch(() => {});
    });
  }
};

module.exports = handler;