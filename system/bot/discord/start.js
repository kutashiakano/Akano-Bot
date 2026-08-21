const chalk = require("chalk");

module.exports = function startDiscord() {
  console.log(chalk.hex("#7289DA")("[DC] Starting Discord Bot..."));
  try {
    const discord = require("./index");
    discord
      .initialize()
      .then((ok) => {
        if (ok) console.log(chalk.hex("#7289DA")("[DC] Ready"));
        else console.log(chalk.red("[DC] Failed to start - check token in settings.js"));
      })
      .catch((e) => global.logError("DC_INIT", e));
  } catch (e) {
    global.logError("DC_INIT", e);
  }
};
