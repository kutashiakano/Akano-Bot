const fs = require("fs");
const path = require("path");

class AutoBackup {
  constructor(dbPath, intervalMs = 3600000) {
    this.dbPath = dbPath;
    this.intervalMs = intervalMs;
    this.backupDir = path.join(path.dirname(dbPath), "backups");
    this.interval = null;
  }

  start() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    this.interval = setInterval(() => this.backup(), this.intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  backup() {
    try {
      if (!fs.existsSync(this.dbPath)) return;
      const data = fs.readFileSync(this.dbPath, "utf-8");
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const backupPath = path.join(this.backupDir, `backup-${timestamp}.json`);
      fs.writeFileSync(backupPath, data);
      this.cleanOldBackups();
    } catch {}
  }

  cleanOldBackups() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith("backup-") && f.endsWith(".json"))
        .sort()
        .reverse();
      if (files.length > 7) {
        for (const file of files.slice(7)) {
          fs.unlinkSync(path.join(this.backupDir, file));
        }
      }
    } catch {}
  }

  restore(backupPath) {
    try {
      const data = fs.readFileSync(backupPath, "utf-8");
      fs.writeFileSync(this.dbPath, data);
      return true;
    } catch {
      return false;
    }
  }

  listBackups() {
    try {
      return fs.readdirSync(this.backupDir)
        .filter(f => f.startsWith("backup-") && f.endsWith(".json"))
        .sort()
        .reverse()
        .map(f => ({
          name: f,
          path: path.join(this.backupDir, f),
          size: fs.statSync(path.join(this.backupDir, f)).size,
        }));
    } catch {
      return [];
    }
  }
}

module.exports = { AutoBackup };
