const database = require("../../../../database");

const HTML = {
  parse_mode: "HTML"
};

async function isAdmin(ctx, userId) {
  if (!userId) return false;
  try {
    const member = await ctx.getChatMember(userId);
    return member && (member.status === "administrator" || member.status === "creator");
  } catch {
    return false;
  }
}

const {define: define} = require("../../../plugin");

module.exports = define({
  name: [ "setwelcome", "setgoodbye", "welcome", "goodbye", "verification", "setverify", "antiflood", "antispam", "antiarab", "antitagall", "antiraid" ],
  category: "admin",
  help: "Manage group settings",
  group: true,
  run: async ctx => {
    const args = ctx.text || "";
    if (ctx.chat.type === "private") {
      return ctx.reply(global.settings.message.group);
    }
    const senderId = ctx.from?.id;
    const isSenderAdmin = await isAdmin(ctx, senderId);
    if (!isSenderAdmin) {
      return ctx.reply(global.settings.message.admin);
    }
    const commandText = ctx.message.text || "";
    const match = commandText.match(/^\/(\w+)/);
    if (!match) return;
    const command = match[1].toLowerCase();
    const db = database.get();
    const groupId = ctx.chat.id;
    if (!db.telegram.groups) db.telegram.groups = {};
    if (!db.telegram.groups[groupId]) {
      db.telegram.groups[groupId] = {
        id: groupId,
        title: ctx.chat.title,
        welcomeMessage: true,
        goodbyeMessage: true,
        autoGreeting: true,
        verification: true,
        moderation: true,
        members: {},
        warnings: {},
        antiflood: false,
        antispam: false,
        antiarab: false,
        antitagall: false,
        antiraid: false,
        createdAt: (new Date).toISOString()
      };
    }
    const group = db.telegram.groups[groupId];
    if (command === "setwelcome") {
      if (!args) {
        return ctx.reply(global.settings.message.welcomeNeedText);
      }
      group.welcomeText = args;
      database.write(db);
      return ctx.reply(global.settings.message.welcomeSet);
    }
    if (command === "setgoodbye") {
      if (!args) {
        return ctx.reply(global.settings.message.goodbyeNeedText);
      }
      group.goodbyeText = args;
      database.write(db);
      return ctx.reply(global.settings.message.goodbyeSet);
    }
    if (command === "setverify") {
      if (!args) {
        return ctx.reply(global.settings.message.verifyNeedText);
      }
      group.verificationText = args;
      database.write(db);
      return ctx.reply(global.settings.message.verifySet);
    }
    const mode = args.trim().toLowerCase();
    if (mode !== "on" && mode !== "off") {
      return ctx.reply(global.settings.message.invalidMode.replace("{command}", command));
    }
    const statusValue = mode === "on";
    switch (command) {
     case "welcome":
      group.autoGreeting = statusValue;
      ctx.reply(`Success: Welcome message has been turned ${mode.toUpperCase()}.`, HTML);
      break;

     case "goodbye":
      group.goodbyeMessage = statusValue;
      ctx.reply(`Success: Goodbye message has been turned ${mode.toUpperCase()}.`, HTML);
      break;

     case "verification":
      group.verification = statusValue;
      ctx.reply(`Success: Group verification has been turned ${mode.toUpperCase()}.`, HTML);
      break;

     case "antiflood":
      group.antiflood = statusValue;
      ctx.reply(`Success: Antiflood has been turned ${mode.toUpperCase()}.`, HTML);
      break;

     case "antispam":
      group.antispam = statusValue;
      ctx.reply(`Success: Antispam link blocker has been turned ${mode.toUpperCase()}.`, HTML);
      break;

     case "antiarab":
      group.antiarab = statusValue;
      ctx.reply(`Success: Antiarab filter has been turned ${mode.toUpperCase()}.`, HTML);
      break;

     case "antitagall":
      group.antitagall = statusValue;
      ctx.reply(`Success: Antitagall restriction has been turned ${mode.toUpperCase()}.`, HTML);
      break;

     case "antiraid":
      group.antiraid = statusValue;
      ctx.reply(`Success: Antiraid lockdown has been turned ${mode.toUpperCase()}.`, HTML);
      break;
    }
    database.write(db);
  }
});