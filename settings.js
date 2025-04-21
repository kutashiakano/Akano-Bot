const fs = require("fs");
const path = require("path");
const gradient = require("gradient-string");

global.owner = [""];
global.settings = {
  cover: "https://files.catbox.moe/0eklgs.jpg",
  footer: "Akano Bot Whatsapp",
  packname: { name: "Akano", author: "Canzy" },
  version: require(process.cwd() + "/package.json").version,
  message: {
    wait: "```Processing. . .```",
    errorF: "This feature is currently disabled due to a bug/error!",
    admin: "This feature is only for group admins!",
    owner: "This feature is only for the bot owner!",
    premium: "This feature is only for premium users!",
    group: "This feature can only be used in groups!",
    private: "This feature can only be used in private chat!",
    botadmin: "Please make the bot an admin before using this feature!",
  },
  dataname: "database.json",
  sessions: "sessions",
  max_uploud: 50,
  dot: "◦",
  reactSW: true,
  emojis: ["❤️", "💛", "💚", "💙", "💜"],
  connection: {
    code_pairing: "AKANOBOT",
    use_pairing: true,
    browser: "opera",
  },
  subbot: {
    sessionbot: "system/jadibot",
    AutoConnect: true,
  },
  opts: {
    autoRead: false,
    selfMode: true,
    dmOnly: false,
    groupOnly: false,
    statusOnly: false,
    queque: true,
    multiprefix: true,
    noprefix: false,
  },
};

global.scraper = new (require("./system/scrapers"))("./system/scrapers/src");

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(gradient(["#FFFFFF", "#4285F4"])("Reloading file: ") + file);
  delete require.cache[file];
  if (global.reloadHandler) {
    global.reloadHandler();
  }
});
