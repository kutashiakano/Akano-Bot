const fs = require("fs");
const path = require("path");
const gradient = require("gradient-string");

global.owner = [""];
global.settings = {
  cover: "",
  footer: "",
  packname: { name: "", author: "" },
  version: require(process.cwd() + "/package.json").version,
  message: {
    wait: "```Processing. . .```",
    errorF:"This feature is currently disabled due to a bug/error!",
    admin: "This feature is only for group admins!",
    owner: "This feature is only for the bot owner!",
    premium: "This feature is only for premium users!",
    group: "This feature can only be used in groups!",
    private: "This feature can only be used in private chat!",
    botadmin: "Please make the bot an admin before using this feature!",
  },
  dataname: "database.json",
  sessions: "sessions",
  sessionbot: "system/jadibot",
  max_uploud: 50,
  dot: "◦",
  connection: {
  code_pairing: "",
  use_pairing: true,
  browser: "opera"
  },
  opts: {
    autoRead: true,
    selfMode: false,
    dmOnly: false,
    groupOnly: false, 
    statusOnly: false,
    queque: true,
    multiprefix: true,
    noprefix: false
  }
};

global.baileys = require("baileys");
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

