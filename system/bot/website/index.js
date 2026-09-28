import path from "path";
import { fileURLToPath, pathToFileURL } from "node:url";
import store from "./dashboard/server/store.js";
import bus from "./dashboard/server/bus.js";
import { applyOverlayToRuntime } from "./dashboard/server/api.js";
import { createServer } from "./dashboard/server/core.js";
import features from "./dashboard/server/features.js";
import tunnel from "./dashboard/server/tunnel.js";

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
    features.init();
    installHooks();
    const server = createServer({
      host: host,
      port: websiteCfg.port,
      mode: mode
    });
    server.on("error", () => {});
    if (websiteCfg.tunnel?.enabled) {
      try {
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

export { init, applyOverlayToRuntime, installHooks };
export default {
  init: init,
  applyOverlayToRuntime: applyOverlayToRuntime,
  installHooks: installHooks,
  __selfTest: process.argv.includes("--selftest")
};

const _isMain = (() => {
  try {
    return !!process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
  } catch {
    return false;
  }
})();
if (_isMain) {
  const root = path.resolve(import.meta.dirname, "../../..");
  if (process.cwd() !== root) process.chdir(root);
  import("../../../settings.js").then(() => {
    init({
      force: true
    });
  }).catch(() => {});
}