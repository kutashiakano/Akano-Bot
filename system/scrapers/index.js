import fs from "fs";
import path from "path";
import { pathToFileURL } from "node:url";

import { promises as fsp } from "fs";

import chalk from "chalk";

const Scandir = async dir => {
  let subdirs = await fsp.readdir(path.resolve(dir));
  let files = await Promise.all(subdirs.map(async subdir => {
    let res = path.resolve(dir, subdir);
    let stats = await fsp.stat(res);
    return stats.isDirectory() ? Scandir(res) : res;
  }));
  return files.flat();
};

class Scraper {
  constructor(dir) {
    this.dir = dir;
    this.init();
  }
  async init() {
    await this.load();
    await this.watch();
  }
  async load() {
    try {
      let files = await Scandir(this.dir);
      for (let file of files) {
        if (!file.endsWith(".js")) continue;
        let name = path.basename(file, ".js");
        try {
          const mod = await import(pathToFileURL(file).href);
          this[name] = mod.default ?? mod;
        } catch (err) {
          console.log(chalk.red.bold(`Failed to load module: ${name}`));
        }
      }
    } catch (err) {
      console.log(chalk.red.bold(`Error loading scraper: ${err.message}`));
    }
  }
  async watch() {
    let chokidar = null;
    try {
      const ck = await import("chokidar");
      chokidar = ck.default ?? ck;
    } catch {}
    if (!chokidar) {
      try {
        const watcher = fs.watch(this.dir, {
          recursive: true
        }, async (eventType, filename) => {
          if (!filename || !String(filename).endsWith(".js")) return;
          const file = path.join(this.dir, String(filename));
          const name = path.basename(file, ".js");
          if (eventType === "rename" && !fs.existsSync(file)) {
            delete this[name];
            return;
          }
          try {
            const mod = await import(pathToFileURL(path.resolve(file)).href + "?t=" + Date.now());
            this[name] = mod.default ?? mod;
          } catch (err) {
            console.log(chalk.red.bold(`Failed to reload module ${name}: ${err.message}`));
          }
        });
        watcher.on?.("error", () => {});
        return watcher;
      } catch {
        return null;
      }
    }
    const watcher = chokidar.watch(this.dir, {
      persistent: true,
      ignoreInitial: true
    });
    watcher.on("add", async file => {
      if (!file.endsWith(".js")) return;
      let name = path.basename(file, ".js");
      try {
        const absPath = path.resolve(this.dir, path.relative(process.cwd(), file));
        const mod = await import(pathToFileURL(absPath).href + "?t=" + Date.now());
        this[name] = mod.default ?? mod;
        console.log(chalk.cyan.bold(`New module added: ${name}`));
      } catch (err) {
        console.log(chalk.red.bold(`Failed to load module ${name}: ${err.message}`));
      }
    });
    watcher.on("change", async file => {
      if (!file.endsWith(".js")) return;
      let name = path.basename(file, ".js");
      try {
        const absPath = path.resolve(this.dir, path.relative(process.cwd(), file));
        const mod = await import(pathToFileURL(absPath).href + "?t=" + Date.now());
        this[name] = mod.default ?? mod;
        console.log(chalk.cyan.bold(`Module updated: ${name}`));
      } catch (err) {
        console.log(chalk.red.bold(`Failed to reload module ${name}: ${err.message}`));
      }
    });
    watcher.on("unlink", async file => {
      if (!file.endsWith(".js")) return;
      let name = path.basename(file, ".js");
      try {
        delete this[name];
        console.log(chalk.cyan.bold(`Module removed: ${name}`));
      } catch (err) {
        console.log(chalk.red.bold(`Failed to unload module ${name}: ${err.message}`));
      }
    });
  }
}

export default Scraper;