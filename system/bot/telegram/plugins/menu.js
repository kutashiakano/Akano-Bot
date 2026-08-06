const { version } = require(process.cwd() + "/package.json");
const moment = require("moment-timezone");

const SESSION_KEY = "__menuState";

function buildCategories(ctx) {
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
  const botname = global.botname || "Bot";
  const username = ctx.from?.username
    ? `@${ctx.from.username}`
    : ctx.from?.first_name || "User";
  const now = moment().tz("Asia/Jakarta");
  const dateStr = now.format("DD/MM/YYYY HH:mm");

  const categories = buildCategories(ctx);
  const catKeys = Object.keys(categories).sort();
  const totalCmds = catKeys.reduce((a, k) => a + categories[k].cmds.length, 0);

  const startTime = global.telegramBot?.startTime || Date.now();
  const uptime = Date.now() - startTime;
  const h = Math.floor(uptime / 3600000);
  const m = Math.floor((uptime % 3600000) / 60000);
  const s = Math.floor((uptime % 60000) / 1000);

  const header =
    `𖦹₊ ⊹ Hi ${username}\n` +
    `I am an automated system (Telegram Bot) which will help you every day ᡣ𐭩\n\n` +
    `      /)    /)\n` +
    `    (｡•ㅅ•｡)〝₎₎ Welcome To The Dashboard ✦₊ ˊ˗\n` +
    ` ╭∪─∪────────── ✦ ⁺.\n` +
    `│  ◦ \n` +
    `│  ◦ Bot: ${botname} v${version}\n` +
    `│  ◦ Uptime: ${h}h ${m}m ${s}s\n` +
    `│  ◦ Date: ${dateStr}\n` +
    `│  ◦ Commands: ${totalCmds}\n` +
    `┗\n\n`;

  const catList = catKeys.map((k, i) => `│ ◦ ${i + 1}. ${k.toUpperCase()}`).join("\n");
  const body =
    `┏「 Categories 」\n` +
    `${catList}\n` +
    `┗¸\n\n`;

  const footer = `₊˚˖ Yo, this bot's still in the works! If you catch any bugs, hit up the owner and let 'em know! ‹𝟹`;

  return header + body + footer;
}

function buildCategoryPage(ctx, catKey, page = 0) {
  const categories = buildCategories(ctx);
  const cat = categories[catKey];
  if (!cat) return null;

  const cmds = cat.cmds.sort();
  const PAGE_SIZE = 8;
  const totalPages = Math.ceil(cmds.length / PAGE_SIZE);
  const pageIndex = Math.max(0, Math.min(page, totalPages - 1));
  const slice = cmds.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);

  let text =
    `┏「 ${catKey.toUpperCase()} 」\n` +
    `│ ◦\n`;

  for (const cmd of slice) {
    const help = cat.help[cmd] ? ` - ${cat.help[cmd]}` : "";
    text += `│  ◦ /${cmd}${help}\n`;
  }
  text += `┗¸\n`;

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
    inline_keyboard: [
      nav,
      [{ text: "Close", callback_data: "menu:close" }]
    ]
  };
}

function buildMainInlineKeyboard(ctx) {
  const categories = buildCategories(ctx);
  const catKeys = Object.keys(categories).sort();
  const rows = [];

  for (let i = 0; i < catKeys.length; i += 2) {
    const row = [
      { text: catKeys[i].toUpperCase(), callback_data: `menu:cat:${catKeys[i]}:0` }
    ];
    if (catKeys[i + 1]) {
      row.push({ text: catKeys[i + 1].toUpperCase(), callback_data: `menu:cat:${catKeys[i + 1]}:0` });
    }
    rows.push(row);
  }
  rows.push([
    { text: "Status", callback_data: "menu:status" },
    { text: "Close", callback_data: "menu:close" }
  ]);

  return { inline_keyboard: rows };
}

function buildStatusInlineKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Main Menu", callback_data: "menu:main" }],
      [{ text: "Close", callback_data: "menu:close" }]
    ]
  };
}

module.exports = {
  help: "Show interactive bot menu",
  command: ["menu", "help", "start"],
  tags: ["info"],

  onCallback: async (ctx) => {
    if (!ctx.session) ctx.session = {};
    const data = ctx.callbackQuery?.data;
    if (!data) return;

    if (data === "menu:main") {
      const menuText = buildMainMenu(ctx);
      await ctx.editMessageCaption(menuText, {
        reply_markup: buildMainInlineKeyboard(ctx),
      }).catch(async () => {
        await ctx.editMessageText(menuText, {
          reply_markup: buildMainInlineKeyboard(ctx),
        }).catch(() => {});
      });
    } else if (data === "menu:status") {
  const botname = global.botname;
      const startTime = global.telegramBot?.startTime || Date.now();
      const uptime = Date.now() - startTime;
      const h = Math.floor(uptime / 3600000);
      const m = Math.floor((uptime % 3600000) / 60000);
      const s = Math.floor((uptime % 60000) / 1000);
      const categories = buildCategories(ctx);
      const totalCmds = Object.values(categories).reduce((a, c) => a + c.cmds.length, 0);
      const totalPlugins = Object.keys(global.telegramPlugins || {}).length;

      const statsText =
        `┏「 System Status 」\n` +
        `│ ◦\n` +
        `│  ◦ Bot     : ${botname}\n` +
        `│  ◦ Version : v${version}\n` +
        `│  ◦ Uptime  : ${h}h ${m}m ${s}s\n` +
        `│  ◦ Plugins : ${totalPlugins}\n` +
        `│  ◦ Commands: ${totalCmds}\n` +
        `│  ◦ Status  : Running\n` +
        `┗¸`;

      await ctx.editMessageCaption(statsText, {
        reply_markup: buildStatusInlineKeyboard(),
      }).catch(async () => {
        await ctx.editMessageText(statsText, {
          reply_markup: buildStatusInlineKeyboard(),
        }).catch(() => {});
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
        await ctx.editMessageCaption(result.text, {
          reply_markup: buildCategoryInlineKeyboard(result.catKey, result.pageIndex, result.totalPages),
        }).catch(async () => {
          await ctx.editMessageText(result.text, {
            reply_markup: buildCategoryInlineKeyboard(result.catKey, result.pageIndex, result.totalPages),
          }).catch(() => {});
        });
      }
    }
  },

  run: async (ctx) => {
    if (!ctx.session) ctx.session = {};
    ctx.session[SESSION_KEY] = {};

    const menuText = buildMainMenu(ctx);
    const cover = global.settings.cover || "https://files.catbox.moe/0eklgs.jpg";

    await ctx.replyWithPhoto(cover, {
      caption: menuText,
      reply_markup: buildMainInlineKeyboard(ctx),
    }).catch(async () => {
      await ctx.reply(menuText, {
        reply_markup: buildMainInlineKeyboard(ctx),
      });
    });
  },
};