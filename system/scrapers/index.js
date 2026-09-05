const chokidar = require("chokidar");
const path = require("path");

const fs = require("fs").promises;

const chalk = require("chalk");

const Scandir = async dir => {
  let subdirs = await fs.readdir(path.resolve(dir));
  let files = await Promise.all(subdirs.map(async subdir => {
    let res = path.resolve(dir, subdir);
    let stats = await fs.stat(res);
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
          this[name] = require(file);
        } catch (err) {
          console.log(chalk.red.bold(`Failed to load module: ${name}`));
        }
      }
    } catch (err) {
      console.log(chalk.red.bold(`Error loading scraper: ${err.message}`));
    }
  }
  async watch() {
    const watcher = chokidar.watch(this.dir, {
      persistent: true,
      ignoreInitial: true
    });
    watcher.on("add", async file => {
      if (!file.endsWith(".js")) return;
      let name = path.basename(file, ".js");
      try {
        const absPath = path.resolve(this.dir, path.relative(process.cwd(), file));
        delete require.cache[absPath];
        this[name] = require(absPath);
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
        delete require.cache[absPath];
        this[name] = require(absPath);
        console.log(chalk.cyan.bold(`Module updated: ${name}`));
      } catch (err) {
        console.log(chalk.red.bold(`Failed to reload module ${name}: ${err.message}`));
      }
    });
    watcher.on("unlink", async file => {
      if (!file.endsWith(".js")) return;
      let name = path.basename(file, ".js");
      try {
        const absPath = path.resolve(this.dir, path.relative(process.cwd(), file));
        delete require.cache[absPath];
        delete this[name];
        console.log(chalk.cyan.bold(`Module removed: ${name}`));
      } catch (err) {
        console.log(chalk.red.bold(`Failed to unload module ${name}: ${err.message}`));
      }
    });
  }
}

module.exports = Scraper;