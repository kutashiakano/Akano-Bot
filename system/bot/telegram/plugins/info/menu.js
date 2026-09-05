const {version: version} = require(process.cwd() + "/package.json");
const moment = require("moment-timezone");

const SESSION_KEY = "__menuState";

const PAGE_SIZE = 8;

function buildCategories(ctx) {
  const isPrivate = ctx.chat?.type === "private";
  const categories = {};
  for (const [name, plugin] of Object.entries(global.telegramPlugins || {})) {
    if (!plugin || plugin.disabled) continue;
    if (isPrivate && plugin.group) continue;
    const cmds = Array.isArray(plugin.command) ? plugin.command : typeof plugin.command === "string" ? [ plugin.command ] : [];
    const tags = Array.isArray(plugin.tags) ? plugin.tags : typeof plugin.tags === "string" ? [ plugin.tags ] : [ "tools" ];
    const tag = tags[0] || "general";
    if (!categories[tag]) categories[tag] = {
      cmds: [],
      help: {}
    };
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
  const username = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "User";
  const now = moment().tz("Asia/Jakarta");
  const dateStr = now.format("DD/MM/YYYY HH:mm");
  const categories = buildCategories(ctx);
  const catKeys = Object.keys(categories).sort();
  const totalCmds = catKeys.reduce((a, k) => a + categories[k].cmds.length, 0);
  const startTime = global.telegramBot?.startTime || Date.now();
  const uptime = Date.now() - startTime;
  const h = Math.floor(uptime / 36e5);
  const m = Math.floor(uptime % 36e5 / 6e4);
  const s = Math.floor(uptime % 6e4 / 1e3);
  const header = `𖦹₊ ⊹ Hi, ${username} ᡣ𐭩\n` + `I am an automated system (Telegram Bot) here to help you every day\n\n` + `      /)    /)\n` + `    (｡•ㅅ•｡)〝₎₎ Welcome To The Dashboard ✦₊ ˊ˗\n` + ` ╭∪─∪────────────── ✦ ⁺.\n` + `│  ◦ Bot      : ${botname} v${version}\n` + `│  ◦ Mode     : ${ctx.chat?.type === "private" ? "Private Chat" : "Group"}\n` + `│  ◦ Uptime   : ${h}h ${m}m ${s}s\n` + `│  ◦ Date     : ${dateStr}\n` + `│  ◦ Commands : ${totalCmds} in ${catKeys.length} categories\n` + `┗\n\n`;
  const catList = catKeys.map((k, i) => `│ ◦ ${i + 1}. ${k.toUpperCase()}`).join("\n");
  const body = `┏「 Categories 」\n` + `${catList}\n` + `┗¸\n\n`;
  const footer = `₊˚˖ Tip: use the buttons below — swipe to browse each category!`;
  return header + body + footer;
}

function buildCategoryPage(ctx, catKey, page = 0) {
  const categories = buildCategories(ctx);
  const cat = categories[catKey];
  if (!cat) return null;
  const cmds = cat.cmds.sort();
  const totalPages = Math.ceil(cmds.length / PAGE_SIZE);
  const pageIndex = Math.max(0, Math.min(page, totalPages - 1));
  const slice = cmds.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);
  let text = `┏「 ${catKey.toUpperCase()} 」\n`;
  for (const cmd of slice) {
    const help = cat.help[cmd] ? ` - ${cat.help[cmd]}` : "";
    text += `│  ◦ /${cmd}${help}\n`;
  }
  text += `┗¸\n`;
  if (totalPages > 1) {
    text += `\nPage ${pageIndex + 1} of ${totalPages}`;
  }
  return {
    text: text,
    pageIndex: pageIndex,
    totalPages: totalPages,
    catKey: catKey
  };
}

function buildCategoryInlineKeyboard(catKey, pageIndex, totalPages) {
  const nav = [];
  if (pageIndex > 0) {
    nav.push({
      text: "< Prev",
      callback_data: `menu:cat:${catKey}:${pageIndex - 1}`
    });
  }
  nav.push({
    text: "Main Menu",
    callback_data: "menu:main"
  });
  if (pageIndex < totalPages - 1) {
    nav.push({
      text: "Next >",
      callback_data: `menu:cat:${catKey}:${pageIndex + 1}`
    });
  }
  return {
    inline_keyboard: [ nav, [ {
      text: "Close",
      callback_data: "menu:close"
    } ] ]
  };
}

function buildEntries(ctx) {
  const categories = buildCategories(ctx);
  const catKeys = Object.keys(categories).sort();
  const entries = [ {
    type: "main"
  } ];
  for (const k of catKeys) {
    const total = Math.max(1, Math.ceil((categories[k].cmds || []).length / PAGE_SIZE));
    for (let p = 0; p < total; p++) {
      entries.push({
        type: "cat",
        key: k,
        page: p
      });
    }
  }
  return entries;
}

function buildSwipeKeyboard(idx, total) {
  return {
    inline_keyboard: [ [ {
      text: "<",
      callback_data: `menu:main:${(idx - 1 + total) % total}`
    }, {
      text: ">",
      callback_data: `menu:main:${(idx + 1) % total}`
    } ], [ {
      text: "Status",
      callback_data: "menu:status"
    }, {
      text: "Close",
      callback_data: "menu:close"
    } ] ]
  };
}

async function renderEntry(ctx, idx = 0) {
  const entries = buildEntries(ctx);
  const i = Math.max(0, Math.min(idx, entries.length - 1));
  const entry = entries[i];
  const kb = buildSwipeKeyboard(i, entries.length);
  const text = entry.type === "main" ? buildMainMenu(ctx) : buildCategoryPage(ctx, entry.key, entry.page)?.text;
  if (!text) return;
  try {
    await ctx.editMessageCaption({
      caption: text,
      reply_markup: kb
    });
  } catch (e) {
    await ctx.editMessageText(text, {
      reply_markup: kb
    }).catch(() => {});
  }
}

function buildStatusInlineKeyboard() {
  return {
    inline_keyboard: [ [ {
      text: "Main Menu",
      callback_data: "menu:main"
    } ], [ {
      text: "Close",
      callback_data: "menu:close"
    } ] ]
  };
}

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "menu", "help", "start" ],
  category: "info",
  help: "Show interactive bot menu",
  cooldown: 0,
  onCallback: async ctx => {
    if (!ctx.session) ctx.session = {};
    const data = ctx.callbackQuery?.data;
    if (!data) return;
    if (data === "menu:main" || data.startsWith("menu:main:")) {
      const idx = parseInt(data.split(":")[2] || "0") || 0;
      await renderEntry(ctx, idx);
    } else if (data === "menu:status") {
      const botname = global.botname;
      const startTime = global.telegramBot?.startTime || Date.now();
      const uptime = Date.now() - startTime;
      const h = Math.floor(uptime / 36e5);
      const m = Math.floor(uptime % 36e5 / 6e4);
      const s = Math.floor(uptime % 6e4 / 1e3);
      const categories = buildCategories(ctx);
      const totalCmds = Object.values(categories).reduce((a, c) => a + c.cmds.length, 0);
      const totalPlugins = Object.keys(global.telegramPlugins || {}).length;
      const statsText = `┏「 System Status 」\n` + `│  ◦ Bot     : ${botname}\n` + `│  ◦ Version : v${version}\n` + `│  ◦ Uptime  : ${h}h ${m}m ${s}s\n` + `│  ◦ Plugins : ${totalPlugins}\n` + `│  ◦ Commands: ${totalCmds}\n` + `│  ◦ Status  : Running\n` + `┗¸`;
      await ctx.editMessageCaption({
        caption: statsText,
        reply_markup: buildStatusInlineKeyboard()
      }).catch(async () => {
        await ctx.editMessageText(statsText, {
          reply_markup: buildStatusInlineKeyboard()
        }).catch(() => {});
      });
    } else if (data === "menu:close") {
      await ctx.deleteMessage().catch(() => {});
    }
  },
  run: async ctx => {
    if (!ctx.session) ctx.session = {};
    ctx.session[SESSION_KEY] = {};
    const entries = buildEntries(ctx);
    const kb = buildSwipeKeyboard(0, entries.length);
    const menuText = buildMainMenu(ctx);
    await ctx.reply(menuText, {
      reply_markup: kb
    }).catch(async () => {
      const plain = menuText.replace(/[𖦹₊⊹ᡣ𐭩✦ˊ˗∪─⁺「」◦┏┗¸‹𝟹]/g, "").replace(/\n{3,}/g, "\n\n");
      await ctx.reply(plain, {
        reply_markup: kb
      }).catch(() => {});
    });
  }
});