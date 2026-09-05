const database = require("../../../../database");
const fmt = require("../../../format");

async function isAdmin(ctx, userId) {
  if (!userId) return false;
  try {
    const m = await ctx.getChatMember(userId);
    return m && (m.status === "administrator" || m.status === "creator");
  } catch {
    return false;
  }
}

async function getChatDesc(ctx) {
  try {
    const c = await ctx.api.getChat(ctx.chat.id);
    return c.description || c.title || "";
  } catch {
    return ctx.chat.title || "";
  }
}

async function getOwnerMention(ctx) {
  try {
    const admins = await ctx.getChatAdministrators();
    const creator = admins.find(a => a.status === "creator");
    if (creator) return `<a href="tg://user?id=${creator.user.id}">${creator.user.first_name}</a>`;
    if (admins[0]) return `<a href="tg://user?id=${admins[0].user.id}">${admins[0].user.first_name}</a>`;
  } catch {}
  return "Owner";
}

function buildText(template, user, chat, ownerMention, desc, count) {
  const safeUser = String(user?.first_name || "Member");
  const safeSubject = String(chat?.title || chat?.username || "Group");
  const safeDesc = String(desc || "").slice(0, 500);
  const safeOwner = ownerMention || "Owner";
  const mention = user?.username ? `@${user.username}` : `<a href="tg://user?id=${user.id}">${safeUser}</a>`;
  const userTag = `<a href="tg://user?id=${user.id}">${safeUser}</a>`;
  return String(template || "").replaceAll("@user", userTag).replaceAll("{user}", userTag).replaceAll("@mention", mention).replaceAll("{mention}", mention).replaceAll("@subject", safeSubject).replaceAll("{subject}", safeSubject).replaceAll("@group", safeSubject).replaceAll("{group}", safeSubject).replaceAll("@server", safeSubject).replaceAll("@desc", safeDesc).replaceAll("{desc}", safeDesc).replaceAll("@description", safeDesc).replaceAll("@owner", safeOwner).replaceAll("{owner}", safeOwner).replaceAll("@count", String(count || "")).replaceAll("{count}", String(count || "")).replaceAll("@id", String(user?.id || "")).replaceAll("{id}", String(user?.id || ""));
}

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "setdesc", "setwcaption", "setwtitle", "welcome", "testwelcome" ],
  category: "group",
  help: "Atur caption canvas & preview welcome",
  example: "%cmd WELCOME | Member #@count in @subject",
  group: true,
  admin: true,
  run: async ctx => {
    const full = ctx.message?.text || ctx.text || "";
    const m = full.match(/^\/(\w+)(?:@\w+)?(?:\s+([\s\S]+))?/);
    if (!m) return;
    const cmd = m[1].toLowerCase();
    const args = (m[2] || "").trim();
    if (ctx.chat.type === "private") return ctx.reply(global.settings.message.welcomePrivate);
    if (!await isAdmin(ctx, ctx.from?.id)) return ctx.reply(global.settings.message.welcomeAdminOnly);
    const db = database.get();
    database.ensureTelegram(db, ctx);
    if (!db.telegram.groups[ctx.chat.id]) db.telegram.groups[ctx.chat.id] = {
      id: ctx.chat.id,
      title: ctx.chat.title
    };
    const g = db.telegram.groups[ctx.chat.id];
    if (cmd === "setwcaption" || cmd === "setdesc" || cmd === "setwtitle") {
      const prefix = global.settings?.telegram?.prefix || "/";
      const ex = "WELCOME | Member #@count in @subject";
      if (!args) {
        const cur = g.welcomeTitle ? `${g.welcomeTitle} | ${g.welcomeCaption || ""}` : g.welcomeCaption || "";
        const sample = (g.welcomeCaption || "New member in @subject").replaceAll("@subject", ctx.chat.title).replaceAll("@count", "123");
        return ctx.reply(`Current caption: <code>${String(cur).replace(/</g, "&lt;")}</code>\n\n${require("../../../format").example(prefix, "setwcaption", ex)}\nResult: ${sample}`, {
          parse_mode: "HTML"
        });
      }
      if (args.includes("|")) {
        const [t, c] = args.split("|").map(s => s.trim());
        if (t) g.welcomeTitle = t.slice(0, 30);
        if (c) g.welcomeCaption = c.slice(0, 100);
      } else {
        g.welcomeCaption = args.slice(0, 100);
      }
      database.write(db);
      const preview = `${g.welcomeTitle || ""} | ${g.welcomeCaption || ""}`;
      return ctx.reply(`Caption updated: <b>${preview.replace(/</g, "&lt;")}</b>`, {
        parse_mode: "HTML"
      });
    }
    if (cmd === "welcome" || cmd === "testwelcome") {
      const desc = await getChatDesc(ctx);
      const owner = await getOwnerMention(ctx);
      const count = await ctx.getChatMemberCount().catch(() => 0);
      const tpl = g.welcomeText || global.settings?.telegram?.groupManager?.welcomeText;
      const text = buildText(tpl, ctx.from, ctx.chat, owner, desc, count);
      try {
        const canvasHelper = require("../../welcome-canvas");
        const buf = await canvasHelper.renderTelegramWelcome(ctx.api, ctx.from, ctx.chat, {
          count: count,
          desc: desc,
          welcomeTitle: g.welcomeTitle,
          welcomeCaption: g.welcomeCaption
        });
        if (buf) {
          let InputFile = null;
          try {
            ({InputFile: InputFile} = require("grammy"));
          } catch {}
          const file = InputFile ? new InputFile(buf, "welcome.png") : buf;
          return ctx.replyWithPhoto(file, {
            caption: text,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [ [ {
                text: "✅ Verify",
                callback_data: `verify:${ctx.from.id}`
              } ] ]
            }
          }).catch(() => ctx.reply(text, {
            parse_mode: "HTML"
          }));
        }
      } catch {}
      return ctx.reply(text, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [ [ {
            text: "✅ Verify",
            callback_data: `verify:${ctx.from.id}`
          } ] ]
        }
      });
    }
  }
});