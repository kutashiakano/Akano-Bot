const fs = require("fs");
const path = require("path");
const gradient = require("gradient-string").default || require("gradient-string");
const ConfigLoader = require("./config/loader");

const cfg = ConfigLoader.load();

global.owner = cfg.owner || [];
global.tgOwner = cfg.tgOwner || [];
global.dcOwner = cfg.dcOwner || [];

global.discord = null;

global.botname = cfg.botname;
global.prefix = cfg.prefix;

const s = cfg.settings;

s.connection = s.connection || {};
if (typeof s.connection.shouldIgnoreJid !== "function") {
  s.connection.shouldIgnoreJid = (jid) => /(newsletter|bot)/.test(jid);
}
if (typeof s.connection.bot !== "function") {
  s.connection.bot = (id) => (id.startsWith("3EB0") && id.length === 40) || id.startsWith("BAE") || /[-]/.test(id);
}

if (s.connection.proxy === undefined) s.connection.proxy = null;
if (s.connection.noProxy === undefined) s.connection.noProxy = "localhost,127.0.0.1";

global.settings = s;
global.fla = global.settings.fla;

if (!global.settings.subbot && global.settings.whatsapp?.subbot) global.settings.subbot = global.settings.whatsapp.subbot;

global.syncSettings = function (db) {
  if (!db) return;
  if (!db.setting) db.setting = {};
  if (!db.users) db.users = [];
  if (!db.groups) db.groups = [];
  if (!db.chats) db.chats = [];
  const cur = global.settings;
  db.setting.prefix = global.prefix;
  db.setting.antilink = cur.group?.antilink;
  db.setting.antivirtex = cur.group?.antivirtex;
  db.setting.antidelete = cur.group?.antidelete;
  db.setting.welcome = cur.group?.welcome;
  db.setting.left = cur.group?.left;
  db.setting.self = cur.security?.self;
  db.setting.groupmode = cur.security?.groupmode;
};

global.scraper = new (require("./system/scrapers"))("./system/scrapers/src");

try {
  try { global.djs = require("./system/bot/sdk").djs() || {}; } catch { global.djs = {}; }
} catch (e) {
  global.djs = {};
}

global.ConfigLoader = ConfigLoader;
global.reloadConfig = () => ConfigLoader.load();

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(gradient(["#FFFFFF", "#4285F4"])("Reloading file: ") + file);
  delete require.cache[file];

  try { delete require.cache[require.resolve("./config/loader")]; } catch {}
  if (global.reloadHandler) {
    global.reloadHandler();
  }
});
