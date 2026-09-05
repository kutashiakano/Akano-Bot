const path = require("path");
const store = require("./dashboard/server/store");
const bus = require("./dashboard/server/bus");
const {applyOverlayToRuntime: applyOverlayToRuntime} = require("./dashboard/server/api");
const {createServer: createServer} = require("./dashboard/server/core");

function installHooks() {
  global.__botEvent = evt => {
    try {
      if (evt.type === "message") bus.pushMessage(evt.data); else if (evt.type === "log") bus.pushLog(evt.data);
    } catch {}
  };
}

function init(options = {}) {
  try {
    const overlay = store.getOverlay();
    const websiteCfg = overlay.settings && overlay.settings.website || global.settings?.website || {};
    const enabled = options.force || websiteCfg.enabled !== false;
    if (!enabled) {
      console.log("[dashboard] disabled via settings (website.enabled=false)");
      return null;
    }
    const mode = websiteCfg.mode === "online" ? "online" : "local";
    const host = mode === "online" ? websiteCfg.host || "0.0.0.0" : "127.0.0.1";
    store.ensureAuthSecret();
    require("./dashboard/server/features").init();
    installHooks();
    const server = createServer({
      host: host,
      port: websiteCfg.port,
      mode: mode
    });
    server.on("error", () => {});
    if (websiteCfg.tunnel?.enabled) {
      try {
        const tunnel = require("./dashboard/server/tunnel");
        tunnel.start(websiteCfg.port || 3001);
      } catch (e) {
        console.error("[dashboard:tunnel] start failed:", e.message);
      }
    }
    return server;
  } catch (e) {
    console.error("[dashboard] init failed (bot continues):", e.message);
    return null;
  }
}

module.exports = {
  init: init,
  applyOverlayToRuntime: applyOverlayToRuntime,
  installHooks: installHooks,
  __selfTest: process.argv.includes("--selftest")
};

if (require.main === module) {
  const root = path.resolve(__dirname, "../../..");
  if (process.cwd() !== root) process.chdir(root);
  require("../../../settings");
  init({
    force: true
  });
}