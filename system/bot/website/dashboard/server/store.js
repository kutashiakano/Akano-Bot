const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const {redactValue: redactValue} = require("./redact");

const DATA_DIR = path.join(process.cwd(), "system", "database");

const DASHBOARD_DIR = path.join(DATA_DIR, "dashboard");

const OVERLAY_FILE = path.join(DASHBOARD_DIR, "settings.json");

const BACKUP_DIR = path.join(DATA_DIR, "backups");

const AUDIT_FILE = path.join(DASHBOARD_DIR, "audit.log");

const AUTH_FILE = path.join(DASHBOARD_DIR, "auth.json");

const MAX_BACKUPS = 3;

for (const old of [ [ "dashboard-settings.json", path.join(DASHBOARD_DIR, "settings.json") ], [ "dashboard-auth.json", path.join(DASHBOARD_DIR, "auth.json") ], [ "dashboard-audit.log", path.join(DASHBOARD_DIR, "audit.log") ] ]) {
  const src = path.join(DATA_DIR, old[0]);
  const dst = old[1];
  if (fs.existsSync(src) && !fs.existsSync(dst)) {
    try {
      fs.mkdirSync(DASHBOARD_DIR, {
        recursive: true
      });
      fs.renameSync(src, dst);
    } catch {}
  }
}

function ensureDirs() {
  fs.mkdirSync(BACKUP_DIR, {
    recursive: true
  });
  fs.mkdirSync(DASHBOARD_DIR, {
    recursive: true
  });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), {
    recursive: true
  });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

let overlay = null;

function getOverlay() {
  if (!overlay) overlay = readJson(OVERLAY_FILE, {});
  return overlay;
}

function saveOverlay(next) {
  ensureDirs();
  if (fs.existsSync(OVERLAY_FILE)) {
    const stamp = (new Date).toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(OVERLAY_FILE, path.join(BACKUP_DIR, `settings-${stamp}.json`));
    const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("settings-")).sort();
    while (files.length > MAX_BACKUPS) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
  }
  overlay = next;
  writeJson(OVERLAY_FILE, redactValue(overlay) === overlay ? overlay : overlay);
  audit("settings.save", "ok");
  return overlay;
}

function listBackups() {
  ensureDirs();
  return fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("settings-") && f.endsWith(".json")).sort().reverse().map(f => {
    const stat = fs.statSync(path.join(BACKUP_DIR, f));
    return {
      file: f,
      ts: stat.mtimeMs,
      size: stat.size
    };
  });
}

function restoreBackup(file) {
  const safe = path.basename(String(file || ""));
  if (!/^settings-[\dT:\-.Z]+\.json$/.test(safe)) throw new Error("invalid backup id");
  const full = path.join(BACKUP_DIR, safe);
  if (!fs.existsSync(full)) throw new Error("backup not found");
  ensureDirs();
  if (fs.existsSync(OVERLAY_FILE)) {
    const stamp = (new Date).toISOString().replace(/[:.]/g, "-");
    fs.copyFileSync(OVERLAY_FILE, path.join(BACKUP_DIR, `settings-${stamp}.json`));
  }
  overlay = JSON.parse(fs.readFileSync(full, "utf8"));
  writeJson(OVERLY_SAFE(), overlay);
  audit("settings.restore", "ok", safe);
  return overlay;
}

function OVERLY_SAFE() {
  return OVERLAY_FILE;
}

function audit(action, result, detail) {
  try {
    ensureDirs();
    const line = JSON.stringify({
      ts: (new Date).toISOString(),
      action: action,
      result: result,
      detail: detail ? String(detail).slice(0, 200) : ""
    }) + "\n";
    fs.appendFileSync(AUDIT_FILE, line);
  } catch {}
}

function readAudit(limit = 100) {
  try {
    const lines = fs.readFileSync(AUDIT_FILE, "utf8").split("\n").filter(Boolean);
    return lines.slice(-limit).reverse().map(l => {
      try {
        return JSON.parse(l);
      } catch {
        return {
          raw: l
        };
      }
    });
  } catch {
    return [];
  }
}

function ensureAuthSecret() {
  let store = readJson(AUTH_FILE, null);
  if (store && store.hash && store.salt) return store;
  const salt = crypto.randomBytes(16).toString("hex");
  const key = process.env.DASHBOARD_KEY || crypto.randomBytes(18).toString("base64url");
  const hash = crypto.createHash("sha256").update(salt + key).digest("hex");
  store = {
    salt: salt,
    hash: hash,
    generatedAt: (new Date).toISOString()
  };
  writeJson(AUTH_FILE, {
    salt: store.salt,
    hash: store.hash,
    generatedAt: store.generatedAt
  });
  if (!process.env.DASHBOARD_KEY) {
    console.log("\n=============================================");
    console.log("  DASHBOARD ACCESS KEY (save it now):");
    console.log("  " + key);
    console.log("=============================================\n");
  }
  return store;
}

function verifyKey(input) {
  const store = ensureAuthSecret();
  const hash = crypto.createHash("sha256").update(store.salt + String(input || "")).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(store.hash));
  } catch {
    return false;
  }
}

module.exports = {
  getOverlay: getOverlay,
  saveOverlay: saveOverlay,
  listBackups: listBackups,
  restoreBackup: restoreBackup,
  audit: audit,
  readAudit: readAudit,
  ensureAuthSecret: ensureAuthSecret,
  verifyKey: verifyKey,
  OVERLAY_FILE: OVERLAY_FILE
};