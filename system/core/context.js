import database from "../database/index.js";

let context = null;

function createContext() {
  return {
    db: database,
    database: database,
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
    }
  };
}

function getContext() {
  if (!context) context = createContext();
  return context;
}

export { getContext, createContext };
export default {
  getContext: getContext,
  createContext: createContext
};