const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");

function hashFileContent(content) {
  return crypto.createHash("md5").update(content).digest("hex").slice(0, 8);
}

function checkSyntax(content, filename) {
  try {
    let code = String(content);
    code = code.replace(/^\s*import\s+.*?from\s+['"].*?['"];?/gm, "");
    code = code.replace(/^\s*import\s*\(.*?\);?/gm, "");
    code = code.replace(/^\s*export\s+/gm, "");
    new vm.Script(code, {
      filename: filename
    });
    return null;
  } catch (e) {
    return e;
  }
}

function reimportFile(filePath) {
  try {
    const abs = path.resolve(filePath);
    delete require.cache[abs];
    const rel = abs.replace(process.cwd(), "");
    delete require.cache[rel];
    require(abs);
    return true;
  } catch (e) {
    console.error(`[reload] failed to reimport ${filePath}:`, e.message);
    return false;
  }
}

function startReloadSystem(opts = {}) {
  const watchPaths = opts.watchPaths || [ path.join(process.cwd(), "system/bot/whatsapp/plugins"), path.join(process.cwd(), "system/bot/discord/plugins"), path.join(process.cwd(), "system/bot/telegram/plugins"), path.join(process.cwd(), "system/core"), path.join(process.cwd(), "system/bot/whatsapp/lib") ];
  const debounceMs = opts.debounceMs || 300;
  const enabled = opts.enabled !== false;
  if (!enabled) return {
    stop: () => {}
  };
  const timers = new Map;
  const watchers = [];
  const fileHashes = new Map;
  function scheduleReload(filePath, type) {
    const key = filePath;
    if (timers.has(key)) clearTimeout(timers.get(key));
    const t = setTimeout(async () => {
      timers.delete(key);
      try {
        if (!fs.existsSync(filePath) && type === "unlink") {
          const abs = path.resolve(filePath);
          delete require.cache[abs];
          console.log(`[reload] DELETE ${path.relative(process.cwd(), filePath)}`);
          if (global.reloadHandler && filePath.includes("handler.js")) {
            try {
              await global.reloadHandler();
            } catch {}
          }
          return;
        }
        if (!fs.existsSync(filePath)) return;
        const content = fs.readFileSync(filePath, "utf8");
        const hash = hashFileContent(content);
        if (fileHashes.get(filePath) === hash) return;
        fileHashes.set(filePath, hash);
        const syntaxErr = checkSyntax(content, filePath);
        if (syntaxErr) {
          console.error(`[reload] syntax error in ${path.relative(process.cwd(), filePath)}: ${syntaxErr.message}`);
          return;
        }
        const isPlugin = /plugins/i.test(filePath);
        const rel = path.relative(process.cwd(), filePath);
        if (isPlugin) {
          const abs = path.resolve(filePath);
          console.log(`[reload] plugin ${type} ${rel} (${hash})`);
          if (global.plugin && type !== "unlink") {
            try {
              delete require.cache[abs];
              const mod = require(abs);
              const key = abs.replace(process.cwd(), "");
              global.plugin[key] = mod;
              global.plugin[key.replace(/\\/g, "/")] = mod;
            } catch (e) {
              console.error(`[reload] plugin reimport failed ${rel}:`, e.message);
            }
          } else if (type === "unlink") {
            const key = abs.replace(process.cwd(), "");
            delete global.plugin?.[key];
          }
        } else {
          const ok = reimportFile(filePath);
          console.log(`[reload] ${type} ${rel} (${hash}) -> ${ok ? "reloaded" : "failed"}`);
          if (ok && global.reloadHandler && /handler\.js|lib\/index\.js|events\.js|socket\.js/.test(filePath)) {
            try {
              await global.reloadHandler();
              console.log("[reload] reloadHandler executed");
            } catch (e) {
              console.error("[reload] reloadHandler failed", e.message);
            }
          }
        }
      } catch (e) {
        console.error(`[reload] error processing ${filePath}:`, e.message);
      }
    }, debounceMs);
    timers.set(key, t);
  }
  let chokidar = null;
  try {
    chokidar = require("chokidar");
  } catch {}
  for (const p of watchPaths) {
    if (!fs.existsSync(p)) continue;
    if (chokidar) {
      const watcher = chokidar.watch(p, {
        persistent: true,
        ignoreInitial: true,
        depth: 5
      });
      watcher.on("add", fp => scheduleReload(fp, "ADD")).on("change", fp => scheduleReload(fp, "EDIT")).on("unlink", fp => scheduleReload(fp, "DELETE"));
      watchers.push(watcher);
      console.log(`[reload] watching ${path.relative(process.cwd(), p)} (chokidar)`);
    } else {
      try {
        const watcher = fs.watch(p, {
          recursive: true
        }, (eventType, filename) => {
          if (!filename) return;
          const fp = path.join(p, filename);
          if (eventType === "rename" && !fs.existsSync(fp)) scheduleReload(fp, "DELETE"); else scheduleReload(fp, eventType === "change" ? "EDIT" : "ADD");
        });
        watchers.push(watcher);
        console.log(`[reload] watching ${path.relative(process.cwd(), p)} (fs.watch)`);
      } catch (e) {
        console.error(`[reload] failed to watch ${p}:`, e.message);
      }
    }
  }
  return {
    stop() {
      for (const w of watchers) {
        try {
          w.close();
        } catch {}
      }
      for (const t of timers.values()) clearTimeout(t);
    }
  };
}

module.exports = {
  startReloadSystem: startReloadSystem,
  checkSyntax: checkSyntax,
  hashFileContent: hashFileContent
};