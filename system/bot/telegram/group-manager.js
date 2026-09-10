const database = require("../../database");
const logger = require("./logger");

const HTML = {
  parse_mode: "HTML"
};

const GroupManager = {
  async handleJoinGroup(ctx) {
    const groupId = ctx.chat.id;
    const db = database.get();
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
      database.write(db);
    }
    if (global.settings.telegram.groupManager.welcomeMessage) {
      const botname = global.botname;
      await ctx.reply(`Hello! I'm ${botname}.\n\n` + `I'm here to help with downloads and group management.\n` + `Use /help to see what I can do.`, HTML).catch(err => {
        logger.error("Failed to send welcome message in group", err);
      });
    }
  },
  getGroupSettings(groupId) {
    const db = database.get();
    return db.telegram.groups && db.telegram.groups[groupId] ? db.telegram.groups[groupId] : null;
  },
  updateGroupSettings(groupId, settings) {
    const db = database.get();
    if (!db.telegram.groups) db.telegram.groups = {};
    db.telegram.groups[groupId] = {
      ...db.telegram.groups[groupId],
      ...settings
    };
    database.write(db);
    return db.telegram.groups[groupId];
  },
  getAllGroups() {
    const db = database.get();
    return db.telegram.groups || {};
  }
};

module.exports = GroupManager;