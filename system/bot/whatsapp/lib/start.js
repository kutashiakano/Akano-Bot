const path = require("path");
const fs = require("fs");
const chalk = require("chalk");

module.exports = function startWhatsApp() {
  const gradient = require("gradient-string").default || require("gradient-string");
  const infoGradient = gradient([ "#00F5A0", "#00D9F5" ]);
  try {
    const baileys = require("baileys");
    const {Client: Client} = require(".");
    const sock = global.settings.connection;
    const waSocket = new Client({
      plugsdir: path.join(__dirname, "..", "plugins"),
      online: sock.online,
      bypass_disappearing: sock.bypass_disappearing,
      bot: sock.bot,
      custom_id: global.botname.toLowerCase().replace(/\s+/g, ""),
      presence: sock.presence,
      pairing: {
        state: sock.use_pairing,
        number: sock.pairing_number,
        code: sock.code_pairing
      },
      create_session: {
        type: "local",
        session: global.settings.sessions
      },
      engines: [ baileys ],
      debug: false
    }, {
      version: sock.version,
      browser: sock.browser,
      shouldIgnoreJid: sock.shouldIgnoreJid
    });
    waSocket.on("connect", () => {});
    waSocket.on("ready", () => {});
    waSocket.on("error", e => {
      const msg = e?.message || String(e);
      if (msg.includes("Connection Terminated") || msg.includes("Connection Failure") || msg.includes("Stream Errored") || msg.includes("Connection Closed") || msg.includes("Bad MAC") || msg.includes("Failed to decrypt")) {
        return;
      }
      global.logError("WA", e);
    });
    waSocket.on("presence.update", () => {});
  } catch (e) {
    global.logError("WA_INIT", e);
  }
};