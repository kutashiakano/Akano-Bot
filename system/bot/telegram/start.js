const chalk = require("chalk");

module.exports = function startTelegram() {
  console.log(chalk.blue("[TG] Starting Telegram Bot..."));
  try {
    const telegram = require("./index");
    telegram
      .initialize()
      .then((ok) => {
        if (ok) console.log(chalk.blue("[TG] Ready"));
        else console.log(chalk.red("[TG] Failed to start - check token in settings.js"));
      })
      .catch((e) => global.logError("TG_INIT", e));
  } catch (e) {
    global.logError("TG_INIT", e);
  }
};
