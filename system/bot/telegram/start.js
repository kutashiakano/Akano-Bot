const chalk = require("chalk");

module.exports = function startTelegram() {
  try {
    const telegram = require("./index");
    telegram.initialize().catch(e => global.logError("TG_INIT", e));
  } catch (e) {
    global.logError("TG_INIT", e);
  }
};