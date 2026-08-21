const database = require("../../../database");

async function isAdmin(ctx, userId) {
  if (!userId) return false;
  try {
    const member = await ctx.getChatMember(userId);
    return member && (member.status === "administrator" || member.status === "creator");
  } catch {
    return false;
  }
}

async function getTargetUser(ctx, args) {
  if (ctx.message?.reply_to_message) {
    const from = ctx.message.reply_to_message.from;
    return { id: from.id, username: from.username, firstName: from.first_name };
  }

  if (args) {
    const text = args.trim();
    if (/^\d+$/.test(text)) {
      return { id: parseInt(text), username: null, firstName: "User" };
    }

    if (text.startsWith("@")) {
      const tgtUser = text.substring(1).toLowerCase();
      const db = database.get();
      const groupId = ctx.chat.id;
      const group = db.telegram.groups?.[groupId];
      if (group && group.members) {
        for (const memberId in group.members) {
          const m = group.members[memberId];
          if (m.username && m.username.toLowerCase() === tgtUser) {
            return { id: m.id, username: m.username, firstName: m.first_name };
          }
        }
      }
    }
  }

  return null;
}


const { define } = require("../../plugin");

module.exports = define({
  name: [
    "mute",
    "unmute",
    "ban",
    "unban",
    "kick",
    "warn",
    "unwarn",
    "warnings",
    "purge",
    "slowmode",
  ],
  category: "moderation",
  help: "Moderation: mute, unmute, ban, unban, kick, warn, unwarn, warnings, purge, slowmode",
  group: true,
  admin: true,
  run: async (ctx) => {

    if (ctx.chat.type === "private") {
      return ctx.reply("🚩 Error: This command can only be used in groups.");
    }

    const senderId = ctx.from?.id;
    const isSenderAdmin = await isAdmin(ctx, senderId);
    if (!isSenderAdmin) {
      return ctx.reply("🚩 Error: This command is only for group administrators.");
    }

    const commandText = ctx.message.text || "";
    const match = commandText.match(/^\/(\w+)/);
    if (!match) return;
    const command = match[1].toLowerCase();

    if (command === "purge") {
      if (!ctx.message.reply_to_message) {
        return ctx.reply("🚩 Error: Please reply to the message where you want to start the purge.");
      }
      const fromId = ctx.message.reply_to_message.message_id;
      const toId = ctx.message.message_id;
      for (let id = fromId; id <= toId; id++) {
        await ctx.deleteMessage(id).catch(() => {});
      }
      return;
    }

    if (command === "slowmode") {
      const seconds = parseInt(args);
      if (isNaN(seconds)) {
        if (args.trim() === "off") {
          await ctx.telegram.setChatSlowMode(ctx.chat.id, 0).catch((err) => {
            return ctx.reply(`🚩 Error: Failed to set slowmode: ${err.message}`);
          });
          return ctx.reply("Slowmode has been disabled.");
        }
        return ctx.reply("🚩 Error: Usage: /slowmode [seconds | off]");
      }
      await ctx.telegram.setChatSlowMode(ctx.chat.id, seconds).catch((err) => {
        return ctx.reply(`🚩 Error: Failed to set slowmode: ${err.message}`);
      });
      return ctx.reply(`Slowmode has been set to ${seconds} seconds.`);
    }

    const target = await getTargetUser(ctx, args);
    if (!target) {
      return ctx.reply("🚩 Error: Please reply to a message or specify @username/user_id.");
    }

    const isTargetAdmin = await isAdmin(ctx, target.id);
    if (isTargetAdmin && ["ban", "kick", "mute", "warn"].includes(command)) {
      return ctx.reply("🚩 Error: You cannot perform moderation actions on administrators.");
    }

    switch (command) {
      case "mute":
        await ctx
          .restrictChatMember(target.id, {
            permissions: {
              can_send_messages: false,
            },
          })
          .catch((err) => {
            return ctx.reply(`🚩 Error: Failed to mute: ${err.message}`);
          });
        ctx.reply(`[Muted] ${target.firstName} has been muted.`, { parse_mode: "HTML" });
        break;

      case "unmute":
        await ctx
          .restrictChatMember(target.id, {
            permissions: {
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
            },
          })
          .catch((err) => {
            return ctx.reply(`🚩 Error: Failed to unmute: ${err.message}`);
          });
        ctx.reply(`[Unmuted] ${target.firstName} has been unmuted.`, { parse_mode: "HTML" });
        break;

      case "ban":
        await ctx.banChatMember(target.id).catch((err) => {
          return ctx.reply(`🚩 Error: Failed to ban: ${err.message}`);
        });
        ctx.reply(`[Banned] ${target.firstName} has been banned.`, { parse_mode: "HTML" });
        break;

      case "unban":
        await ctx.unbanChatMember(target.id).catch((err) => {
          return ctx.reply(`🚩 Error: Failed to unban: ${err.message}`);
        });
        ctx.reply(`[Unbanned] ${target.firstName} has been unbanned.`, { parse_mode: "HTML" });
        break;

      case "kick":
        await ctx.banChatMember(target.id).catch((err) => {
          return ctx.reply(`🚩 Error: Failed to kick: ${err.message}`);
        });
        await ctx.unbanChatMember(target.id).catch(() => {});
        ctx.reply(`[Kicked] ${target.firstName} has been kicked.`, { parse_mode: "HTML" });
        break;

      case "warn":
        const db = database.get();
        const groupId = ctx.chat.id;
        if (!db.telegram.groups[groupId].warnings) db.telegram.groups[groupId].warnings = {};
        const warnings = db.telegram.groups[groupId].warnings;
        warnings[target.id] = (warnings[target.id] || 0) + 1;
        database.write(db);

        if (warnings[target.id] >= 3) {
          warnings[target.id] = 0;
          database.write(db);
          await ctx.banChatMember(target.id).catch(() => {});
          ctx.reply(
            `[Banned] User ${target.firstName} reached 3 warnings and was banned from the group.`,
            { parse_mode: "HTML" },
          );
        } else {
          ctx.reply(
            `[Warning] User ${target.firstName} has been warned. Total warnings: ${warnings[target.id]}/3.`,
            { parse_mode: "HTML" },
          );
        }
        break;

      case "unwarn":
        const dbUnwarn = database.get();
        const groupIdUnwarn = ctx.chat.id;
        if (
          dbUnwarn.groups[groupIdUnwarn].warnings &&
          dbUnwarn.groups[groupIdUnwarn].warnings[target.id]
        ) {
          dbUnwarn.groups[groupIdUnwarn].warnings[target.id] = Math.max(
            0,
            dbUnwarn.groups[groupIdUnwarn].warnings[target.id] - 1,
          );
          database.write(dbUnwarn);
          ctx.reply(
            `[Warning] Removed 1 warning from ${target.firstName}. Total: ${dbUnwarn.groups[groupIdUnwarn].warnings[target.id]}/3.`,
            { parse_mode: "HTML" },
          );
        } else {
          ctx.reply(`User ${target.firstName} has no active warnings.`, { parse_mode: "HTML" });
        }
        break;

      case "warnings":
        const dbWarns = database.get();
        const groupIdWarns = ctx.chat.id;
        const count =
          (dbWarns.groups[groupIdWarns].warnings &&
            dbWarns.groups[groupIdWarns].warnings[target.id]) ||
          0;
        ctx.reply(`[Warning] User ${target.firstName} has ${count}/3 warnings.`, {
          parse_mode: "HTML",
        });
        break;
    }
  
  },
});
