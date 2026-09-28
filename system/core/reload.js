import fs from "fs";
import path from "path";
import crypto from "crypto";
import vm from "vm";
import { pathToFileURL } from "node:url";

let _chokidar = null;
try {
  const _ck = await import("chokidar");
  _chokidar = _ck.default ?? _ck;
} catch {}

function hashFileContent(content) {
  return crypto.createHash("md5").update(content).digest("hex").slice(0, 8);
}

function checkSyntax(content, filename) {
  try {
    let code = String(content);
    code = code.replace(/^\s*import\s+type\s+[^;]+;/gm, "");
    code = code.replace(/\bimport\s*\(([^)]*)\)/g, "(__import__($1))");
    code = code.replace(/^\s*import\s*['"][^'"]*['"]\s*;?/gm, "");
    code = code.replace(/^\s*import\s+[\s\S]*?\s+from\s*['"][^'"]*['"]\s*;?/gm, "");
    code = code.replace(/^\s*export\s+default\s+/gm, "void ");
    code = code.replace(/^\s*export\s*\{[^}]*\}\s*(from\s*['"][^'"]*['"])?\s*;?/gm, "");
    code = code.replace(/^\s*export\s+(?=(?:async\s+)?(?:function|class|const|let|var)\b)/gm, "");
    code = code.replace(/\bimport\.meta\b/g, "(__import_meta__)");
    new vm.Script(code, {
      filename: filename
    });
    return null;
  } catch (e) {
    return e;
  }
}

async function reimportFile(filePath) {
  try {
    const abs = path.resolve(filePath);
    const content = fs.readFileSync(abs, "utf8");
    const url = pathToFileURL(abs).href + "?t=" + hashFileContent(content);
    await import(url);
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
              const mod = await import(pathToFileURL(abs).href + "?t=" + hash);
              const loaded = mod.default ?? mod;
              const key = abs.replace(process.cwd(), "");
              global.plugin[key] = loaded;
              global.plugin[key.replace(/\\/g, "/")] = loaded;
            } catch (e) {
              console.error(`[reload] plugin reimport failed ${rel}:`, e.message);
            }
          } else if (type === "unlink") {
            const key = abs.replace(process.cwd(), "");
            delete global.plugin?.[key];
          }
        } else {
          const ok = await reimportFile(filePath);
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
  let chokidar = _chokidar;
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

export { startReloadSystem, checkSyntax, hashFileContent };
export default {
  startReloadSystem: startReloadSystem,
  checkSyntax: checkSyntax,
  hashFileContent: hashFileContent
};