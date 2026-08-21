const { version } = require(process.cwd() + "/package.json");
const moment = require("moment-timezone");

const SESSION_KEY = "__menuState";

const tagMap = {
  info: "Info",
  ai: "Artificial Intelligence",
  downloader: "Downloader",
  moderation: "Moderation",
  admin: "Admin",
  owner: "Owner",
  settings: "Settings",
  statistics: "Statistics",
  utility: "Utility",
  general: "General",
};

function catRows(ctx) {
  const isPrivate = ctx.chat?.type === "private";
  const categories = {};
  for (const [name, plugin] of Object.entries(global.telegramPlugins || {})) {
    if (!plugin || plugin.disabled) continue;
    if (isPrivate && plugin.group) continue;

    const cmds = Array.isArray(plugin.command)
      ? plugin.command
      : typeof plugin.command === "string"
        ? [plugin.command]
        : [];

    const tags = Array.isArray(plugin.tags)
      ? plugin.tags
      : typeof plugin.tags === "string"
        ? [plugin.tags]
        : ["general"];

    const tag = tags[0] || "general";

    if (!categories[tag]) categories[tag] = { cmds: [], help: {} };
    for (const cmd of cmds) {
      if (!categories[tag].cmds.includes(cmd)) {
        categories[tag].cmds.push(cmd);
        if (plugin.help && typeof plugin.help === "string") {
          categories[tag].help[cmd] = plugin.help;
        }
      }
    }
  }
  return categories;
}

function buildMainMenu(ctx) {
  const botname = global.botname;
  const username = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "User";
  const now = moment().tz("Asia/Jakarta");
  const dateStr = now.format("DD/MM/YYYY HH:mm");

  const categories = catRows(ctx);
  const catKeys = Object.keys(categories).sort();
  const totalCmds = catKeys.reduce((a, k) => a + categories[k].cmds.length, 0);

  const startTime = global.telegramBot?.startTime || Date.now();
  const uptime = Date.now() - startTime;
  const h = Math.floor(uptime / 3600000);
  const m = Math.floor((uptime % 3600000) / 60000);
  const s = Math.floor((uptime % 60000) / 1000);

  const header =
    `──────────────────\n` +
    `\n` +
    `*U S E R*\n` +
    `- \`Name:\` ${username}\n` +
    `- \`Status:\` ${ctx.from?.id ? "User" : "User"}\n` +
    `- \`ID:\` ${ctx.from?.id || "-"}\n` +
    `\n` +
    `──────────────────\n` +
    `\n` +
    `*I N F O R M A T I O N*\n` +
    `- \`Bot Name:\` ${botname}\n` +
    `- \`Version:\` v${version}\n` +
    `- \`Commands:\` ${totalCmds}\n` +
    `- \`Uptime:\` ${h}h ${m}m ${s}s\n` +
    `- \`Date:\` ${dateStr}\n` +
    `\n` +
    `──────────────────`;

  return header;
}

function buildCategoryPage(ctx, catKey, page = 0) {
  const categories = catRows(ctx);
  const cat = categories[catKey];
  if (!cat) return null;

  const cmds = cat.cmds.sort();
  const PAGE_SIZE = 8;
  const totalPages = Math.ceil(cmds.length / PAGE_SIZE);
  const pageIndex = Math.max(0, Math.min(page, totalPages - 1));
  const slice = cmds.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);

  let text = `*ᗢ ${tagMap[catKey] || catKey}*\n\n`;
  for (const cmd of slice) {
    const help = cat.help[cmd] ? ` - ${cat.help[cmd]}` : "";
    text += `- /${cmd}${help}\n`;
  }

  if (totalPages > 1) {
    text += `\nPage ${pageIndex + 1} of ${totalPages}`;
  }

  return { text, pageIndex, totalPages, catKey };
}

function buildCategoryInlineKeyboard(catKey, pageIndex, totalPages) {
  const nav = [];
  if (pageIndex > 0) {
    nav.push({ text: "< Prev", callback_data: `menu:cat:${catKey}:${pageIndex - 1}` });
  }
  nav.push({ text: "Main Menu", callback_data: "menu:main" });
  if (pageIndex < totalPages - 1) {
    nav.push({ text: "Next >", callback_data: `menu:cat:${catKey}:${pageIndex + 1}` });
  }

  return {
    inline_keyboard: [nav, [{ text: "Close", callback_data: "menu:close" }]],
  };
}

function mainKb(ctx) {
  const categories = catRows(ctx);
  const catKeys = Object.keys(categories).sort();
  const rows = [];

  for (let i = 0; i < catKeys.length; i += 2) {
    const row = [
      {
        text: (tagMap[catKeys[i]] || catKeys[i]).toUpperCase(),
        callback_data: `menu:cat:${catKeys[i]}:0`,
      },
    ];
    if (catKeys[i + 1]) {
      row.push({
        text: (tagMap[catKeys[i + 1]] || catKeys[i + 1]).toUpperCase(),
        callback_data: `menu:cat:${catKeys[i + 1]}:0`,
      });
    }
    rows.push(row);
  }
  rows.push([
    { text: "Status", callback_data: "menu:status" },
    { text: "Close", callback_data: "menu:close" },
  ]);

  return { inline_keyboard: rows };
}

function buildStatusInlineKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Main Menu", callback_data: "menu:main" }],
      [{ text: "Close", callback_data: "menu:close" }],
    ],
  };
}


const { define } = require("../../plugin");

module.exports = define({
  name: ["menu", "help", "start"],
  category: "([info])[0] || general",
  help: "Show interactive bot menu",
  onCallback: async (ctx) => {
    if (!ctx.session) ctx.session = {};
    const data = ctx.callbackQuery?.data;
    if (!data) return;

    if (data === "menu:main") {
      const menuText = buildMainMenu(ctx);
      await ctx
        .editMessageCaption(menuText, {
          reply_markup: mainKb(ctx),
        })
        .catch(async () => {
          await ctx
            .editMessageText(menuText, {
              reply_markup: mainKb(ctx),
            })
            .catch(() => {});
        });
    } else if (data === "menu:status") {
      const botname = global.botname;
      const startTime = global.telegramBot?.startTime || Date.now();
      const uptime = Date.now() - startTime;
      const h = Math.floor(uptime / 3600000);
      const m = Math.floor((uptime % 3600000) / 60000);
      const s = Math.floor((uptime % 60000) / 1000);
      const categories = catRows(ctx);
      const totalCmds = Object.values(categories).reduce((a, c) => a + c.cmds.length, 0);
      const totalPlugins = Object.keys(global.telegramPlugins || {}).length;

      const statsText =
        `*ᗢ System Status*\n\n` +
        `- \`Bot\`     : ${botname}\n` +
        `- \`Version\` : v${version}\n` +
        `- \`Uptime\`  : ${h}h ${m}m ${s}s\n` +
        `- \`Plugins\` : ${totalPlugins}\n` +
        `- \`Commands\`: ${totalCmds}\n` +
        `- \`Status\`  : Running`;

      await ctx
        .editMessageCaption(statsText, {
          reply_markup: buildStatusInlineKeyboard(),
        })
        .catch(async () => {
          await ctx
            .editMessageText(statsText, {
              reply_markup: buildStatusInlineKeyboard(),
            })
            .catch(() => {});
        });
    } else if (data === "menu:close") {
      await ctx.deleteMessage().catch(() => {});
    } else if (data.startsWith("menu:cat:")) {
      const parts = data.split(":");
      const catKey = parts[2];
      const page = parseInt(parts[3] || "0");
      const result = buildCategoryPage(ctx, catKey, page);
      if (result) {
        ctx.session[SESSION_KEY] = { catKey: result.catKey, page: result.pageIndex };
        await ctx
          .editMessageCaption(result.text, {
            reply_markup: buildCategoryInlineKeyboard(
              result.catKey,
              result.pageIndex,
              result.totalPages,
            ),
          })
          .catch(async () => {
            await ctx
              .editMessageText(result.text, {
                reply_markup: buildCategoryInlineKeyboard(
                  result.catKey,
                  result.pageIndex,
                  result.totalPages,
                ),
              })
              .catch(() => {});
          });
      }
    }
  },
  run: async (ctx) => {
    
        if (!ctx.session) ctx.session = {};
        ctx.session[SESSION_KEY] = {};
    
        const menuText = buildMainMenu(ctx);
        const cover = global.settings.cover || "https://files.catbox.moe/0eklgs.jpg";
    
        await ctx
          .replyWithPhoto(cover, {
            caption: menuText,
            reply_markup: mainKb(ctx),
          })
          .catch(async () => {
            await ctx.reply(menuText, {
              reply_markup: mainKb(ctx),
            });
          });
  },
});
