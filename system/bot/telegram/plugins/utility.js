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
    "pin",
    "unpin",
    "lock",
    "unlock",
    "setrules",
    "rules",
    "report",
    "admins",
    "promote",
    "demote",
  ],
  category: "utility",
  help: "Group tools: pin, lock, rules, report, promote/demote members",
  group: true,
  run: async (ctx) => {

    if (ctx.chat.type === "private") {
      return ctx.reply("🚩 Error: This command can only be used in groups.");
    }

    const commandText = ctx.message.text || "";
    const match = commandText.match(/^\/(\w+)/);
    if (!match) return;
    const command = match[1].toLowerCase();

    if (command === "rules") {
      const db = database.get();
      const group = db.telegram.groups?.[ctx.chat.id];
      const rulesText = group?.rules || "No rules set for this group yet.";
      return ctx.reply(`Group Rules:\n\n${rulesText}`, { parse_mode: "HTML" });
    }

    if (command === "report") {
      if (!ctx.message.reply_to_message) {
        return ctx.reply("🚩 Error: Please reply to the message you want to report.");
      }
      try {
        const chatAdministrators = await ctx.getChatAdministrators();
        const mentions = chatAdministrators
          .filter((adm) => !adm.user.is_bot)
          .map((adm) => `<a href="tg://user?id=${adm.user.id}">${adm.user.first_name}</a>`)
          .join(", ");

        await ctx.reply(
          `Report Sent to Admins!\n\n` +
            `Reported message: <a href="https://t.me/c/${ctx.chat.id.toString().replace("-100", "")}/${ctx.message.reply_to_message.message_id}">Link</a>\n` +
            `Admins alerted: ${mentions}`,
          { parse_mode: "HTML" },
        );
      } catch (err) {
        ctx.reply("🚩 Error: Failed to report message.");
      }
      return;
    }

    if (command === "admins") {
      try {
        const chatAdministrators = await ctx.getChatAdministrators();
        const list = chatAdministrators
          .filter((adm) => !adm.user.is_bot)
          .map(
            (adm) =>
              `• <b>${adm.user.first_name}</b> (@${adm.user.username || "no_username"}) [${adm.status}]`,
          )
          .join("\n");
        return ctx.reply(`Group Administrators:\n\n${list}`, { parse_mode: "HTML" });
      } catch (err) {
        return ctx.reply("🚩 Error: Failed to fetch administrators list.");
      }
    }

    const senderId = ctx.from?.id;
    const isSenderAdmin = await isAdmin(ctx, senderId);
    if (!isSenderAdmin) {
      return ctx.reply("🚩 Error: This command is only for group administrators.");
    }

    switch (command) {
      case "pin":
        if (!ctx.message.reply_to_message) {
          return ctx.reply("🚩 Error: Please reply to the message you want to pin.");
        }
        await ctx.pinChatMessage(ctx.message.reply_to_message.message_id).catch((err) => {
          return ctx.reply(`🚩 Error: Failed to pin message: ${err.message}`);
        });
        ctx.reply("Message pinned successfully.");
        break;

      case "unpin":
        await ctx.unpinChatMessage().catch((err) => {
          return ctx.reply(`🚩 Error: Failed to unpin: ${err.message}`);
        });
        ctx.reply("Pinned message has been unpinned.");
        break;

      case "lock":
        if (!args) {
          return ctx.reply("🚩 Error: Please specify what to lock. Options: messages, media");
        }
        const lockTarget = args.trim().toLowerCase();
        if (lockTarget === "messages") {
          await ctx
            .setChatPermissions({
              permissions: { can_send_messages: false },
            })
            .catch((err) => {
              return ctx.reply(`🚩 Error: ${err.message}`);
            });
          ctx.reply("Chat has been locked. Only admins can send messages.");
        } else if (lockTarget === "media") {
          await ctx
            .setChatPermissions({
              permissions: { can_send_messages: true, can_send_media_messages: false },
            })
            .catch((err) => {
              return ctx.reply(`🚩 Error: ${err.message}`);
            });
          ctx.reply("Media sending has been locked.");
        } else {
          ctx.reply("🚩 Error: Invalid lock target. Choose 'messages' or 'media'.");
        }
        break;

      case "unlock":
        if (!args) {
          return ctx.reply("🚩 Error: Please specify what to unlock. Options: messages, media");
        }
        const unlockTarget = args.trim().toLowerCase();
        if (unlockTarget === "messages") {
          await ctx
            .setChatPermissions({
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
              return ctx.reply(`🚩 Error: ${err.message}`);
            });
          ctx.reply("Chat has been unlocked. Everyone can send messages.");
        } else if (unlockTarget === "media") {
          await ctx
            .setChatPermissions({
              permissions: {
                can_send_messages: true,
                can_send_media_messages: true,
              },
            })
            .catch((err) => {
              return ctx.reply(`🚩 Error: ${err.message}`);
            });
          ctx.reply("Media sending has been unlocked.");
        } else {
          ctx.reply("🚩 Error: Invalid unlock target. Choose 'messages' or 'media'.");
        }
        break;

      case "setrules":
        if (!args) {
          return ctx.reply("🚩 Error: Please provide rules text.");
        }
        const db = database.get();
        if (!db.telegram.groups[ctx.chat.id]) {
          db.telegram.groups[ctx.chat.id] = { id: ctx.chat.id, title: ctx.chat.title, rules: "" };
        }
        db.telegram.groups[ctx.chat.id].rules = args;
        database.write(db);
        ctx.reply("Group rules updated successfully.");
        break;

      case "promote":
        const targetPromo = await getTargetUser(ctx, args);
        if (!targetPromo)
          return ctx.reply("🚩 Error: Please reply to a message or mention the user to promote.");
        await ctx
          .promoteChatMember(targetPromo.id, {
            can_change_info: true,
            can_post_messages: true,
            can_edit_messages: true,
            can_delete_messages: true,
            can_invite_users: true,
            can_restrict_members: true,
            can_pin_messages: true,
            can_promote_members: false,
          })
          .catch((err) => {
            return ctx.reply(`🚩 Error: Failed to promote: ${err.message}`);
          });
        ctx.reply(
          `[Promoted] <b>${targetPromo.firstName}</b> has been promoted to Administrator.`,
          { parse_mode: "HTML" },
        );
        break;

      case "demote":
        const targetDemo = await getTargetUser(ctx, args);
        if (!targetDemo)
          return ctx.reply("🚩 Error: Please reply to a message or mention the user to demote.");
        await ctx
          .promoteChatMember(targetDemo.id, {
            can_change_info: false,
            can_post_messages: false,
            can_edit_messages: false,
            can_delete_messages: false,
            can_invite_users: false,
            can_restrict_members: false,
            can_pin_messages: false,
            can_promote_members: false,
          })
          .catch((err) => {
            return ctx.reply(`🚩 Error: Failed to demote: ${err.message}`);
          });
        ctx.reply(`<b>${targetDemo.firstName}</b> has been demoted.`, { parse_mode: "HTML" });
        break;
    }
  
  },
});
