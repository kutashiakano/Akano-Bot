const chalk = require("chalk");

module.exports = function startDiscord() {
  try {
    const discord = require("./index");
    discord.initialize().catch(e => global.logError("DC_INIT", e));
  } catch (e) {
    global.logError("DC_INIT", e);
  }
};