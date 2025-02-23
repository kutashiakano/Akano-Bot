/*
 * This is where all the magic happens, nya~
 * Feel free to customize your bot's database however you want, Honey~
 * Make it purrfect for your needs! UwU
 */

module.exports = (m) => {
  const isNumber = (x) => typeof x === "number" && !isNaN(x);
  const delay = (ms) =>
    isNumber(ms) && new Promise((resolve) => setTimeout(resolve, ms));

  let user = global.db.data.users[m.sender];
  if (typeof user !== "object") global.db.data.users[m.sender] = {};
  if (user) {
    if (!isNumber(user.exp)) user.exp = 0;
    if (!isNumber(user.limit)) user.limit = 100;
    if (!isNumber(user.money)) user.money = 100000;
    if (!("registered" in user)) user.registered = false;
    if (!("premium" in user)) user.premium = false;
    if (!user.registered) {
      if (!("name" in user)) user.name = m.name;
      if (!isNumber(user.age)) user.age = 0;
      if (!isNumber(user.level)) user.level = 0;
      if (!isNumber(user.regTime)) user.regTime = 0;
      if (!isNumber(user.warn)) user.warn = 0;
    }
  } else
    global.db.data.users[m.sender] = {
      exp: 0,
      limit: 100,
      money: 10000,
      registered: false,
      name: m.name,
      age: "-",
      regTime: 0,
      banned: false,
      premium: false,
      level: 1,
      role: "Nothing",
      warn: 0,
    };

  let chat = global.db.data.chats[m.chat];
  if (!m.isGroup) return;
  if (typeof chat !== "object") global.db.data.chats[m.chat] = {};

  if (!global.db.data.chats[m.chat]) {
    global.db.data.chats[m.chat] = {};
  }

  if (chat) {
    if (!("isBanned" in chat)) chat.isBanned = false;
    if (!("welcome" in chat)) chat.welcome = true;
    if (!("mute" in chat)) chat.mute = false;
    if (!("sewa" in chat)) chat.sewa = false;
    if (!("member" in chat)) chat.member = [];
    if (!("antiDelete" in chat)) chat.antiDelete = [];
    if (!isNumber(chat.chat)) chat.chat = 0;
    if (!isNumber(chat.expired)) chat.expired = 0;
  } else
    global.db.data.chats[m.chat] = {
      welcome: true,
      antiLink: true,
      sewa: false,
      mute: false,
      member: [],
      chat: 0,
      expired: 0,
      welcome: `┌─⭓「 *WELCOME USER* 」
│ *• Meow meow!* %member just jumped into %subject!
│ *• Time to purr together at:* %time
└───────────────⭓

*• Why did you join? Tell us, nya~!* %reason`,
      leave: `┌─⭓「 *GOOBYE USER* 」
│ *• Someone just left the den...* %subject
│ *• Time they sneaked away:* %time
└───────────────⭓

*• Why did they leave? Hmm~?* %reason`,
    };

  let settings = global.db.data.settings;
  if (typeof settings !== "object") global.db.data.settings[this.user.jid] = {};
  if (settings) {
    if (!("blockcmd" in settings)) settings.blockcmd = [];
    if (!isNumber(settings.start)) settings.start = 0;
  } else
    global.db.data.settings = {
      blockcmd: [],
      start: 0,
    };
};
