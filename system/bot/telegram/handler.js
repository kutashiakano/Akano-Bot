const database = require("../../database");
const logger = require("./logger");
const groupManager = require("./group-manager");
const moment = require("moment-timezone");

const fmt = require("../format");
const tgCool = new Map();
const floodCache = new Map();

async function isAdmin(ctx, userId) {
  if (!userId) return false;
  try {
    const member = await ctx.getChatMember(userId);
    return member && (member.status === "administrator" || member.status === "creator");
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
};

const handler = {
  setup(bot) {
    bot.use((ctx, next) => {
      ctx.user = ctx.from;
      ctx.username = ctx.from?.username || "Unknown";

      if (ctx.message) {
        const msgId = ctx.message.message_id;

        const _reply = ctx.reply.bind(ctx);
        ctx.reply = (text, extra = {}) => _reply(text, { reply_to_message_id: msgId, ...extra });

        if (ctx.replyWithPhoto) {
          const _rp = ctx.replyWithPhoto.bind(ctx);
          ctx.replyWithPhoto = (photo, extra = {}) =>
            _rp(photo, { reply_to_message_id: msgId, ...extra });
        }
        if (ctx.replyWithVideo) {
          const _rv = ctx.replyWithVideo.bind(ctx);
          ctx.replyWithVideo = (video, extra = {}) =>
            _rv(video, { reply_to_message_id: msgId, ...extra });
        }
        if (ctx.replyWithAudio) {
          const _ra = ctx.replyWithAudio.bind(ctx);
          ctx.replyWithAudio = (audio, extra = {}) =>
            _ra(audio, { reply_to_message_id: msgId, ...extra });
        }

        ctx.replyWithQuote = (text, targetMsgId, extra = {}) =>
          _reply(text, { reply_to_message_id: targetMsgId || msgId, ...extra });
      }

      return next();
    });

    bot.on("message", async (ctx, next) => {
      const msg = ctx.message;
      if (!msg) return next();

      ctx._receivedAt = Date.now();

      try {
        require("../print")({ type: "telegram", ctx });
      } catch (e) {}

      if (ctx.chat?.type === "private" && msg.text && !msg.text.startsWith("/")) {
        try {
          const regPlugin = global.telegramPlugins["register"];
          if (regPlugin && typeof regPlugin.run === "function") {
            await regPlugin.run(ctx);
          }
        } catch (e) {}
      }

      if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
        const db = database.get();
        database.ensureTelegram(db, ctx);
        database.write(db);

        const group = db.telegram.groups[ctx.chat.id] || {};
        const isUserAdmin = await isAdmin(ctx, ctx.from?.id);

        if (!isUserAdmin) {
          const msgText = msg.text || "";

          if (group.antispam && msgText) {
            if (/https?:\/\/[^\s]+/gi.test(msgText)) {
              await ctx.deleteMessage().catch(() => {});
              return;
            }
          }

          if (group.antiarab) {
            const isArab =
              /[\u0600-\u06FF]/i.test(msgText) ||
              /[\u0600-\u06FF]/i.test(ctx.from?.first_name || "");
            if (isArab) {
              await ctx.deleteMessage().catch(() => {});
              await ctx.banChatMember(ctx.from.id).catch(() => {});
              await ctx.unbanChatMember(ctx.from.id).catch(() => {});
              return;
            }
          }

          if (group.antitagall && msgText) {
            if (msgText.includes("@all") || msgText.includes("@everyone")) {
              await ctx.deleteMessage().catch(() => {});
              return;
            }
          }

          if (group.antiflood && ctx.from) {
            const userId = ctx.from.id;
            const now = Date.now();
            if (!floodCache.has(userId)) floodCache.set(userId, []);
            const ts = floodCache.get(userId);
            ts.push(now);
            const active = ts.filter((t) => now - t < 5000);
            floodCache.set(userId, active);
            if (active.length > 5) {
              await ctx
                .restrictChatMember(userId, {
                  permissions: { can_send_messages: false },
                })
                .catch(() => {});
              ctx.reply(
                `[Muted] User ${ctx.from.first_name} has been muted for flooding messages.`,
              );
              return;
            }
          }

          if (group.verification && msgText === "Verify") {
            await ctx
              .restrictChatMember(ctx.from.id, {
                permissions: FULL_PERMISSIONS,
              })
              .catch(() => {});
            return ctx.reply("Verification successful. You can now chat.", {
              reply_markup: { remove_keyboard: true },
            });
          }
        }
      }

      for (const name in global.telegramPlugins) {
        const pl = global.telegramPlugins[name];
        if (pl && typeof pl.before === "function") {
          try {
            const stop = await pl.before(ctx, { budy: msg.text || "" });
            if (stop === true) return;
          } catch (e) {
            global.logError("telegram.before", e);
          }
        }
      }

      const text = msg.text || "";
      if (!text) return next();

      const match = text.match(/^\/(\w+)(?:\s+(.+))?/);
      if (!match) return next();

      const command = match[1].toLowerCase();
      const args = match[2] || "";

      logger.cmd(ctx, command, args);

      let plugin = global.telegramPlugins[command];
      if (!plugin) {
        plugin = Object.values(global.telegramPlugins).find((p) => {
          if (Array.isArray(p.command))
            return p.command.map((c) => c.toLowerCase()).includes(command);
          if (typeof p.command === "string") return p.command.toLowerCase() === command;
          return false;
        });
      }

      if (!plugin && command) {
        const all = Object.values(global.telegramPlugins)
          .flatMap((p) => (Array.isArray(p.command) ? p.command : [p.command]).filter(Boolean))
          .map((c) => String(c).toLowerCase());
        const sgs = fmt.matcher(command, all).slice(0, 3);
        if (sgs.length) {
          const caption =
            fmt.texted("bold", "Command not found.") +
            " Did you mean:\n\n" +
            sgs.map((v, i) => `*${i + 1}.* /${v.string} (${v.accuracy}%)`).join("\n");
          return await ctx.reply(caption).catch(() => {});
        }
      }

      try {
        const dbDisabled = database.get().settings?.disabledPlugins?.telegram || [];
        if (dbDisabled.includes(command)) {
          return ctx
            .reply("Sorry, this feature is currently disabled due to an error!")
            .catch(() => {});
        }
      } catch (e) {}

      if (plugin && typeof plugin.run === "function") {
        const uid = String(ctx.from?.id || "");
        const isOwner =
          (global.settings?.telegram?.owner || global.tgOwner || []).includes(uid) ||
          global.owner.map((o) => o.replace(/[^\d]/g, "")).includes(uid);
        const inGroup = ctx.chat?.type === "group" || ctx.chat?.type === "supergroup";
        const dbNow = database.get();
        const user = dbNow?.telegram?.users?.[uid];
        const isPrem = !!user?.premium;

        if (plugin.owner && !isOwner) {
          return ctx.reply(fmt.texted("bold", fmt.status("owner"))).catch(() => {});
        }
        if (plugin.private && inGroup) {
          return ctx.reply(fmt.texted("bold", fmt.status("private"))).catch(() => {});
        }
        if (plugin.group && !inGroup) {
          return ctx.reply(fmt.texted("bold", fmt.status("group"))).catch(() => {});
        }
        if (plugin.admin && !(await isAdmin(ctx, ctx.from?.id))) {
          return ctx.reply(fmt.texted("bold", fmt.status("admin"))).catch(() => {});
        }
        if (plugin.premium && !isPrem && !isOwner) {
          return ctx.reply(fmt.texted("bold", fmt.status("premium"))).catch(() => {});
        }
        if (plugin.cooldown > 0 && !isOwner) {
          const key = uid + ":" + command;
          const last = tgCool.get(key) || 0;
          if (Date.now() - last < plugin.cooldown) {
            return ctx
              .reply(fmt.texted("bold", fmt.status("cooldown")))
              .catch(() => {});
          }
          tgCool.set(key, Date.now());
        }

        try {
          if (global.settings?.telegram?.autoTyping) {
            await ctx.sendChatAction("typing").catch(() => {});
          }
          if (global.settings.opts.pending || global.settings.opts.queque) {
            await plugin.run(ctx, args);
          } else {
            await plugin.run(ctx, args);
          }
        } catch (error) {
          const pName = command;
          const db = database.get();
          if (!db.settings) db.settings = {};
          if (!db.settings.pluginErrors) db.settings.pluginErrors = { telegram: {}, discord: {} };
          if (!db.settings.pluginErrors.telegram[pName])
            db.settings.pluginErrors.telegram[pName] = 0;
          db.settings.pluginErrors.telegram[pName] += 1;
          global.logError("telegram.plugin", error);
          if (db.settings.pluginErrors.telegram[pName] >= 5) {
            delete global.telegramPlugins[pName];
            if (!db.settings.disabledPlugins)
              db.settings.disabledPlugins = { telegram: [], discord: [] };
            if (!db.settings.disabledPlugins.telegram.includes(pName)) {
              db.settings.disabledPlugins.telegram.push(pName);
            }
          }
          database.write(db);
          ctx
            .reply("Sorry, an error occurred while running this feature. Please try again later!")
            .catch(() => {});
        }
      }
    });

    bot.on("my_chat_member", async (ctx) => {
      const status = ctx.update.my_chat_member.new_chat_member.status;
      if (status === "member" || status === "administrator") {
        try {
          await groupManager.handleJoinGroup(ctx);
        } catch (error) {
          global.logError("telegram.groupJoin", error);
        }
      }
    });

    bot.on("new_chat_members", async (ctx) => {
      try {
        const groupId = ctx.chat.id;
        const db = database.get();
        const groupSettings = db.telegram.groups?.[groupId] || {};
        const newMembers = ctx.message.new_chat_members;

        for (const member of newMembers) {
          if (member.is_bot) continue;

          if (groupSettings.autoGreeting) {
            const firstName = member.first_name || "Member";
            const username = member.username ? `@${member.username}` : "N/A";
            const memberId = member.id;
            const time = moment().tz("Asia/Jakarta").format("YYYY-MM-DD HH:mm:ss");

            const welcomeText =
              groupSettings.welcomeText ||
              `<b>Welcome to the Group!</b>\n` +
                `──────────────────────\n` +
                `Name: ${firstName}\n` +
                `Username: ${username}\n` +
                `User ID: <code>${memberId}</code>\n` +
                `Time: ${time}\n` +
                `──────────────────────\n` +
                `<i>Enjoy your stay and follow the rules!</i>`;

            await ctx
              .replyWithPhoto(global.settings.cover, {
                caption: welcomeText,
                parse_mode: "HTML",
              })
              .catch(async () => {
                await ctx.reply(welcomeText, { parse_mode: "HTML" }).catch(() => {});
              });
          }

          if (groupSettings.verification) {
            await ctx
              .restrictChatMember(member.id, {
                permissions: {
                  can_send_messages: true,
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
                },
              })
              .catch(() => {});

            const defaultPrompt = `Welcome ${member.first_name || "Member"}. Please press the <b>Verify</b> button to start chatting.`;
            const verifyText = (groupSettings.verificationText || defaultPrompt).replace(
              "%member%",
              member.first_name || "Member",
            );

            await ctx.reply(verifyText, {
              parse_mode: "HTML",
              reply_markup: {
                keyboard: [[{ text: "Verify" }]],
                one_time_keyboard: true,
                resize_keyboard: true,
              },
            });
          }
        }
      } catch (error) {
        global.logError("telegram.newMembers", error);
      }
    });

    bot.on("left_chat_member", async (ctx) => {
      try {
        const groupId = ctx.chat.id;
        const db = database.get();
        const groupSettings = db.telegram.groups?.[groupId] || {};

        if (groupSettings.goodbyeMessage) {
          const member = ctx.message.left_chat_member;
          const firstName = member.first_name || "Member";
          const goodbyeText = groupSettings.goodbyeText || `${firstName} has left the group.`;
          await ctx.reply(goodbyeText, { parse_mode: "HTML" });
        }
      } catch (error) {
        global.logError("telegram.leftMember", error);
      }
    });

    bot.on("callback_query", async (ctx) => {
      const data = ctx.callbackQuery.data;
      if (data && data.startsWith("menu:")) {
        const menuPlugin = global.telegramPlugins["menu"];
        if (menuPlugin && typeof menuPlugin.onCallback === "function") {
          try {
            await menuPlugin.onCallback(ctx);
          } catch (error) {
            global.logError("telegram.menuCallback", error);
          }
        }
      } else if (data && (data.startsWith("reglang:") || data.startsWith("age:"))) {
        const regPlugin = global.telegramPlugins["register"];
        if (regPlugin && typeof regPlugin.onCallback === "function") {
          try {
            await regPlugin.onCallback(ctx);
          } catch (error) {
            global.logError("telegram.registerCallback", error);
          }
        }
      }
      await ctx.answerCbQuery().catch(() => {});
    });
  },
};

module.exports = handler;
