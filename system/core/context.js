const database = require("../database");

let context = null;

function createContext() {
  return {
    db: database,
    database,

    get settings() {
      return global.settings;
    },
    get owner() {
      return global.owner;
    },
    get botname() {
      return global.botname;
    },
    get prefix() {
      return global.prefix;
    },
    get discordCommands() {
      return global.discordCommands;
    },
    get discord() {
      return global.discord;
    },
    get scraper() {
      return global.scraper;
    },
    get logError() {
      return global.logError;
    },

    set(name, value) {
      global[name] = value;
      return this;
    },
  };
}

function getContext() {
  if (!context) context = createContext();
  return context;
}

module.exports = { getContext, createContext };