const fetch = require("node-fetch");
const FileType = require("file-type");
const fs = require("fs");
const EventEmitter = require("events");
const path = require("path");
const chokidar = require("chokidar");
const syntaxerror = require("syntax-error");
const pino = require("pino");
const NodeCache = require("node-cache");
const yargs = require("yargs/yargs");
const _ = require("lodash");
const { makeInMemoryStore } = require("baileys");

const { extendChats } = require("./chats");
const { extendGroups } = require("./groups");
const { extendMessages } = require("./messages");
const { extendNewsletter } = require("./newsletter");
const { extendBusiness } = require("./business");
const { extendCommunities } = require("./communities");
const { serializeM, smsg } = require("./serializer");
const utils = require("./utils");
const auth = require("./auth");
const socket = require("./socket");
const events = require("./events");

async function scanDir(dir) {
  let entries = await fs.promises.readdir(dir, { withFileTypes: true });
  let files = await Promise.all(
    entries.map(async (entry) => {
      let safeName = path.basename(entry.name);
      let res = `${dir}${path.sep}${safeName}`;
      return entry.isDirectory() ? scanDir(res) : res;
    })
  );
  return files.reduce((a, f) => a.concat(f), []);
}

function isSafeUrl(url) {
  try {
    const { hostname } = new URL(url);
    return !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|::1)/i.test(hostname);
  } catch {
    return false;
  }
}

function makeWASocket(existingSock, store, options = {}) {
  let sock = existingSock || options.sock;
  if (!sock) throw new Error("makeWASocket: an existing Baileys socket must be provided");

  sock.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  sock.story = async (m) => { return global.status || [] };

  const ephemeral = global.settings.connection?.bypass_disappearing ? {} : { ephemeralExpiration: 86400 };

  extendChats(sock, store, ephemeral);
  extendGroups(sock);
  extendMessages(sock, store, ephemeral);
  extendNewsletter(sock);
  extendBusiness(sock);
  extendCommunities(sock);

  sock.logger = {
    ...sock.logger,
    info() {},
    error() {},
    warn() {},
  };

  sock.sizeLimit = async (str, max) => {
    let upperStr = str.toUpperCase();
    if (upperStr.startsWith("HTTP")) {
      if (!isSafeUrl(str)) return { oversize: true, error: "Blocked URL" };
      try {
        const response = await fetch(str, { method: "HEAD" });
        const fileSize = response.headers.get("content-length");
        if (!fileSize) return { oversize: true, error: "File size not found" };
        const fileSizeMB = parseFloat(
          (parseInt(fileSize, 10) / (1024 * 1024)).toFixed(2)
        );
        return { oversize: fileSizeMB > max, size: `${fileSizeMB}MB` };
      } catch {
        return { oversize: true, error: "Failed to fetch URL" };
      }
    }
    if (/G(B)?|T(B)?/.test(upperStr)) return { oversize: true };
    if (/M(B)?/.test(upperStr)) {
      let first = parseFloat(upperStr.replace(/MB|M|G|T/gi, "").trim());
      if (isNaN(first)) return { oversize: true };
      return { oversize: first > max, size: `${first}MB` };
    }
    return { oversize: false };
  };

  sock.getFile = async (PATH) => {
    let res;
    const data = Buffer.isBuffer(PATH)
      ? PATH
      : /^data:.*?\/.*?;base64,/i.test(PATH)
      ? Buffer.from(PATH.split`,`[1], "base64")
      : /^https?:\/\//.test(PATH)
      ? (isSafeUrl(PATH) ? await (res = await fetch(PATH)).buffer() : (() => { throw new Error("Blocked URL"); })())
      : fs.existsSync(PATH)
      ? fs.readFileSync(PATH)
      : typeof PATH === "string"
      ? PATH
      : Buffer.alloc(0);

    if (!Buffer.isBuffer(data)) throw new TypeError("Result is not a buffer");
    const type = (await FileType.fromBuffer(data)) || {
      mime: "application/octet-stream",
      ext: ".bin",
    };

    return {
      res,
      ...type,
      data,
    };
  };

  sock.serializeM = (m) => {
    return serializeM(sock, m);
  };

  sock.parseMention = (text) => {
    if (!text || typeof text !== "string") return [];
    return [...text.matchAll(/@([0-9]{5,16}|0)/g)].map(
      (v) => v[1] + "@s.whatsapp.net"
    );
  };

  sock.resize = async (input, width, height) => {
    try {
      let data;
      if (Buffer.isBuffer(input)) {
        data = input;
      } else if (/^https?:\/\//.test(input)) {
        if (!isSafeUrl(input)) return null;
        const res = await fetch(input);
        data = await res.buffer();
      } else if (fs.existsSync(input)) {
        data = fs.readFileSync(input);
      } else {
        return null;
      }
      const jimpPkg = require("jimp");
      const JimpClass = jimpPkg.Jimp || jimpPkg;
      const image = await JimpClass.read(data);
      const w = width || 300;
      const h = height || 300;
      if (typeof image.resize === "function") {
        try {
          image.resize({ w, h });
        } catch {
          try {
            image.resize(w, h);
          } catch {
            image.resize({ width: w, height: h });
          }
        }
      }
      const mime = (jimpPkg.Jimp || jimpPkg).MIME_JPEG || "image/jpeg";
      if (typeof image.getBuffer === "function") {
        const buf = image.getBuffer(mime);
        return buf instanceof Promise ? await buf : buf;
      }
      if (typeof image.getBufferAsync === "function") {
        return await image.getBufferAsync(mime);
      }
      return null;
    } catch (e) {
      console.error("[resize error]", e.message);
      return null;
    }
  };

  Object.defineProperty(sock, "name", {
    value: "WASocket",
    configurable: true,
  });

  return sock;
}

class Client extends EventEmitter {
  constructor(opts = {}, baileysOpts = {}) {
    super();
    this.opts = opts;
    this.baileysOpts = baileysOpts;
    process.nextTick(() => {
      this.init().catch((err) => {
        console.error("Client init error:", err);
        process.exit(1);
      });
    });
  }

  async init() {
    global.settings = global.settings || {};
    global.settings.connection = global.settings.connection || {};
    global.settings.connection.use_pairing = this.opts.pairing ? this.opts.pairing.state : true;
    global.settings.connection.code_pairing = this.opts.pairing ? this.opts.pairing.code : "NEOXRBOT";
    global.settings.connection.pairing_number = this.opts.pairing ? this.opts.pairing.number : "";
    global.settings.connection.online = this.opts.online;
    global.settings.connection.presence = this.opts.presence;
    global.settings.connection.bypass_disappearing = this.opts.bypass_disappearing;
    global.settings.connection.browser = this.baileysOpts.browser;
    global.settings.connection.version = this.baileysOpts.version;
    global.settings.connection.shouldIgnoreJid = this.baileysOpts.shouldIgnoreJid;
    global.settings.connection.bot = this.opts.bot;

    if (this.opts.create_session && this.opts.create_session.session) {
      global.settings.sessions = this.opts.create_session.session;
    }

    global.opts = {
      ...new Object(yargs(process.argv.slice(2)).exitProcess(false).parse()),
    };

    global.prefix = new RegExp(
      "^[" +
        (global.opts["prefix"] || "xzXZ/i!#$%+£¢€¥^°=¶∆×÷π√✓©®:;?&.-").replace(
          /[|\\{}()[\]^$+*?.\-\^]/g,
          "\\$&"
        ) +
        "]"
    );

    const database = require("../../../database");

    const dbFile = database.path;

    const WA_KEYS = ["users", "chats", "newsletters", "stats", "msgs", "sticker", "settings", "respon", "texts", "logerror"];

    const db = {
      data: null,
      READ: false,
      read: async () => {
        try {
          if (fs.existsSync(dbFile)) {
            db.data = JSON.parse(fs.readFileSync(dbFile, "utf-8"));
          } else {
            db.data = {};
            fs.mkdirSync(path.dirname(dbFile), { recursive: true });
            fs.writeFileSync(dbFile, JSON.stringify(db.data, null, 2));
          }
        } catch {
          db.data = {};
        }
      },
      write: async () => {
        await database.withLock(() => {
          let merged = {};
          try {
            merged = JSON.parse(fs.readFileSync(dbFile, "utf-8"));
          } catch {}
          for (const key of WA_KEYS) merged[key] = db.data[key];
          database.writeFileAtomic(dbFile, merged);
        });
      }
    };

    global.db = db;
    global.DATABASE = db;

    global.loadDatabase = async function loadDatabase() {
      if (!db.READ) {
        setInterval(async () => {
          await db.write();
        }, 300000);
      }
      if (db.data !== null) return;
      db.READ = true;
      await db.read();
      db.READ = false;
      db.data = {
        users: {},
        chats: {},
        newsletters: [],
        telegram: { groups: {} },
        discord: { servers: {} },
        stats: {},
        msgs: {},
        sticker: {},
        settings: {},
        respon: {},
        texts: JSON.parse(JSON.stringify(require("../../../database").defaultTexts)),
        logerror: [],
        ...(db.data || {}),
      };
      db.chain = _.chain(db.data);
    };
    await global.loadDatabase();

    global.authFolder = global.settings.sessions || "sessions";

    if (!fs.existsSync("tmp")) fs.mkdirSync("tmp");
    if (!fs.existsSync(global.authFolder)) fs.mkdirSync(global.authFolder, { recursive: true });

    const logger = pino({ level: "silent" });
    global.store = makeInMemoryStore({ logger });
    global.store.readFromFile(path.join(process.cwd(), global.authFolder, "store.json"));

    const statusPath = path.join(process.cwd(), global.authFolder, "status.json");
    global.status = [];
    try {
      if (fs.existsSync(statusPath)) {
        global.status = JSON.parse(fs.readFileSync(statusPath));
      }
    } catch (error) {
      global.status = [];
      fs.writeFileSync(statusPath, JSON.stringify([]));
    }

    const { state, saveCreds } = await auth.initAuth(global.authFolder);
    const msgRetryCounterCache = new NodeCache();
    const version = undefined;

    let isInit = true;
    const handlerPath = path.join(__dirname, "..", "handler.js");
    let handler = require(handlerPath);

    const self = this;

    global.reloadHandler = async function (restartConn) {
      let Handler = require(handlerPath);
      if (Object.keys(Handler || {}).length) handler = Handler;

      const oldSock = global.sock;

      if (restartConn) {
        try {
          oldSock.ev.removeAllListeners();
          oldSock.ws.close();
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const newRawSock = await socket.createSocket(state, logger, version, global.store, msgRetryCounterCache);
        global.store.bind(newRawSock.ev);
        global.sock = makeWASocket(newRawSock, global.store);
      }

      if (!isInit && oldSock) {
        if (typeof oldSock.handler === "function") {
          oldSock.ev.off("messages.upsert", oldSock.handler);
        }
        if (typeof oldSock.onParticipantsUpdate === "function") {
          oldSock.ev.off("group-participants.update", oldSock.onParticipantsUpdate);
        }
        if (typeof oldSock.credsUpdate === "function") {
          oldSock.ev.off("creds.update", oldSock.credsUpdate);
        }
      }

      global.sock.handler = handler.handler.bind(global.sock);
      global.sock.onParticipantsUpdate = handler.participantsUpdate.bind(global.sock);
      global.sock.credsUpdate = saveCreds.bind(global.sock);

      global.sock.ev.on("messages.upsert", global.sock.handler);
      global.sock.ev.on("group-participants.update", global.sock.onParticipantsUpdate);
      global.sock.ev.on("creds.update", global.sock.credsUpdate);

      events.bindEvents(global.sock, global.store, saveCreds, global.reloadHandler, statusPath, logger);

      isInit = false;
      return true;
    };

    const rawSock = await socket.createSocket(state, logger, version, global.store, msgRetryCounterCache);
    global.sock = makeWASocket(rawSock, global.store);
    global.store.bind(global.sock.ev);
    global.sock.statusJid = [];

    await global.reloadHandler();

    this.ev = global.sock.ev;

    global.sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;
      if (connection === "open") {
        self.emit("connect");
        self.emit("ready");
      }
      if (connection === "close") {
        self.emit("error", lastDisconnect?.error);
      }
    });

    global.sock.ev.on("messages.upsert", (upsert) => {
      self.emit("message", upsert);
    });

    global.sock.ev.on("presence.update", (presence) => {
      self.emit("presence.update", presence);
    });

    console.log("Loading plugins...");
    global.plugin = {};

    try {
      const defaultPlugs = path.join(__dirname, "..", "plugins");
      const plugsPath = this.opts.plugsdir ? path.resolve(this.opts.plugsdir) : defaultPlugs;
      let files = await scanDir(plugsPath);
      let plugin = {};

      for (let filename of files.map((a) => a.replace(process.cwd(), ""))) {
        try {
          const fullPath = path.join(process.cwd(), filename);
          plugin[filename] = require(fullPath);
        } catch (e) {
          console.error(e);
        }
      }

      const watcher = chokidar.watch(plugsPath, {
        persistent: true,
        ignoreInitial: true,
      });

      watcher
        .on("add", (filename) => {
          const rel = filename.replace(process.cwd(), "");
          plugin[rel] = require(filename);
        })
        .on("change", (filename) => {
          const rel = filename.replace(process.cwd(), "");
          if (require.cache[filename]?.id === filename) {
            plugin[rel] = require.cache[filename].exports;
            delete require.cache[filename];
          }
          if (!fs.existsSync(filename)) return;
          let err = syntaxerror(fs.readFileSync(filename), rel);
          if (!err) {
            plugin[rel] = require(filename);
          }
        })
        .on("unlink", (filename) => {
          const rel = filename.replace(process.cwd(), "");
          delete plugin[rel];
        });

      plugin = Object.fromEntries(
        Object.entries(plugin).sort(([a], [b]) => a.localeCompare(b))
      );
      global.plugin = plugin;
      console.log(`Loaded ${Object.keys(plugin).length} plugins`);
    } catch (e) {
      console.error(e);
    }

    setInterval(async () => {
      try {
        const sessionDir = path.join(process.cwd(), global.authFolder);
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });
        if (global.store.groupMetadata) {
          fs.writeFileSync(
            path.join(sessionDir, "store-group.json"),
            JSON.stringify(global.store.groupMetadata)
          );
        }
        if (global.store.contacts) {
          fs.writeFileSync(
            path.join(sessionDir, "store-contacts.json"),
            JSON.stringify(global.store.contacts)
          );
        }
        global.store.writeToFile(path.join(sessionDir, "store.json"));
      } catch (e) {
        // silent store write errors
      }
    }, 300000);

    // Telegram & Discord started separately via main.js flag system
  }
}

module.exports = {
  Client,
  makeWASocket,
  serializeM,
  smsg,
  utils,
  auth,
  socket,
  events
};
