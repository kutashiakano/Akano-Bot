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

module.exports = {
  group: true,
  tags: ['admin'],
  command: ['setwelcome', 'setgoodbye', 'welcome', 'goodbye', 'verification', 'setverify', 'antiflood', 'antispam', 'antiarab', 'antitagall', 'antiraid'],
  help: 'Group admin: welcome, goodbye, verification, antiflood, antispam, antiarab, antitagall, antiraid',
  run: async (ctx, args) => {
    if (ctx.chat.type === "private") {
      return ctx.reply("Error: This command can only be used in groups.");
    }

    const senderId = ctx.from?.id;
    const isSenderAdmin = await isAdmin(ctx, senderId);
    if (!isSenderAdmin) {
      return ctx.reply("Error: This command is only for group administrators.");
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
        createdAt: new Date().toISOString()
      };
    }

    const group = db.telegram.groups[groupId];

    if (command === "setwelcome") {
      if (!args) {
        return ctx.reply("Error: Please provide a welcome message. Example: /setwelcome Welcome %member% to %subject%!");
      }
      group.welcomeText = args;
      database.write(db);
      return ctx.reply("Success: Custom welcome message set successfully.");
    }

    if (command === "setgoodbye") {
      if (!args) {
        return ctx.reply("Error: Please provide a goodbye message. Example: /setgoodbye Goodbye %member%!");
      }
      group.goodbyeText = args;
      database.write(db);
      return ctx.reply("Success: Custom goodbye message set successfully.");
    }

    if (command === "setverify") {
      if (!args) {
        return ctx.reply("Error: Please provide a verification message. Example: /setverify Welcome %member%! Please press the Verify button to start chatting.");
      }
      group.verificationText = args;
      database.write(db);
      return ctx.reply("Success: Custom verification message set successfully.");
    }

    const mode = args.trim().toLowerCase();
    if (mode !== "on" && mode !== "off") {
      return ctx.reply(`Error: Usage: /${command} [on | off]`);
    }

    const statusValue = mode === "on";

    switch (command) {
      case "welcome":
        group.autoGreeting = statusValue;
        ctx.reply(`Success: Welcome message has been turned ${mode.toUpperCase()}.`, { parse_mode: "HTML" });
        break;

      case "goodbye":
        group.goodbyeMessage = statusValue;
        ctx.reply(`Success: Goodbye message has been turned ${mode.toUpperCase()}.`, { parse_mode: "HTML" });
        break;

      case "verification":
        group.verification = statusValue;
        ctx.reply(`Success: Group verification has been turned ${mode.toUpperCase()}.`, { parse_mode: "HTML" });
        break;

      case "antiflood":
        group.antiflood = statusValue;
        ctx.reply(`Success: Antiflood has been turned ${mode.toUpperCase()}.`, { parse_mode: "HTML" });
        break;

      case "antispam":
        group.antispam = statusValue;
        ctx.reply(`Success: Antispam link blocker has been turned ${mode.toUpperCase()}.`, { parse_mode: "HTML" });
        break;

      case "antiarab":
        group.antiarab = statusValue;
        ctx.reply(`Success: Antiarab filter has been turned ${mode.toUpperCase()}.`, { parse_mode: "HTML" });
        break;

      case "antitagall":
        group.antitagall = statusValue;
        ctx.reply(`Success: Antitagall restriction has been turned ${mode.toUpperCase()}.`, { parse_mode: "HTML" });
        break;

      case "antiraid":
        group.antiraid = statusValue;
        ctx.reply(`Success: Antiraid lockdown has been turned ${mode.toUpperCase()}.`, { parse_mode: "HTML" });
        break;
    }

    database.write(db);
  }
};
