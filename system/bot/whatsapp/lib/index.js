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
const {makeInMemoryStore: makeInMemoryStore} = require("baileys");
const {extendChats: extendChats} = require("./chats");
const {extendGroups: extendGroups} = require("./groups");
const {extMsgs: extMsgs} = require("./messages");
const {extNews: extNews} = require("./newsletter");
const {serializeM: serializeM, smsg: smsg} = require("./serializer");
const utils = require("./utils");
const adapter = require("./adapter");
const auth = adapter;

const proxy = require("./proxy");
const socket = require("./socket");
const events = require("./events");

function makeWASocket(existingSock, store, options = {}) {
  let sock = existingSock || options.sock;
  if (!sock) throw new Error("makeWASocket: an existing Baileys socket must be provided");
  sock.delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  sock.story = async m => global.status || [];
  const ephemeral = global.settings.connection?.bypass_disappearing ? {} : {
    ephemeralExpiration: 86400
  };
  extendChats(sock, store, ephemeral);
  extendGroups(sock);
  extMsgs(sock, store, ephemeral);
  extNews(sock);
  sock.logger = {
    ...sock.logger,
    info() {},
    error() {},
    warn() {}
  };
  sock.sizeLimit = async (str, max) => {
    let upperStr = str.toUpperCase();
    if (upperStr.startsWith("HTTP")) {
      try {
        const agent = proxy.getProxyAgent(str);
        const response = await fetch(str, {
          method: "HEAD",
          ...agent ? {
            agent: agent
          } : {}
        });
        const fileSize = response.headers.get("content-length");
        if (!fileSize) return {
          oversize: true,
          error: "File size not found"
        };
        const fileSizeMB = parseFloat((parseInt(fileSize, 10) / (1024 * 1024)).toFixed(2));
        return {
          oversize: fileSizeMB > max,
          size: `${fileSizeMB}MB`
        };
      } catch {
        return {
          oversize: true,
          error: "Failed to fetch URL"
        };
      }
    }
    if (/G(B)?|T(B)?/.test(upperStr)) return {
      oversize: true
    };
    if (/M(B)?/.test(upperStr)) {
      let first = parseFloat(upperStr.replace(/MB|M|G|T/gi, "").trim());
      if (isNaN(first)) return {
        oversize: true
      };
      return {
        oversize: first > max,
        size: `${first}MB`
      };
    }
    return {
      oversize: false
    };
  };
  sock.getFile = async PATH => {
    let res;
    const data = Buffer.isBuffer(PATH) ? PATH : /^data:.*?\/.*?;base64,/i.test(PATH) ? Buffer.from(PATH.split`,`[1], "base64") : /^https?:\/\//.test(PATH) ? await (res = await fetch(PATH, {
      ...proxy.getProxyAgent(PATH) ? {
        agent: proxy.getProxyAgent(PATH)
      } : {}
    })).buffer() : fs.existsSync(PATH) ? fs.readFileSync(PATH) : typeof PATH === "string" ? PATH : Buffer.alloc(0);
    if (!Buffer.isBuffer(data)) throw new TypeError("Result is not a buffer");
    const type = await FileType.fromBuffer(data) || {
      mime: "application/octet-stream",
      ext: ".bin"
    };
    return {
      res: res,
      ...type,
      data: data
    };
  };
  sock.serializeM = m => serializeM(sock, m);
  sock.parseMention = text => {
    if (!text || typeof text !== "string") return [];
    return [ ...text.matchAll(/@([0-9]{5,16}|0)/g) ].map(v => v[1] + "@s.whatsapp.net");
  };
  sock.resize = async (input, width, height) => {
    try {
      let data;
      if (Buffer.isBuffer(input)) {
        data = input;
      } else if (/^https?:\/\//.test(input)) {
        const agent = proxy.getProxyAgent(input);
        const res = await fetch(input, {
          ...agent ? {
            agent: agent
          } : {}
        });
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
          image.resize({
            w: w,
            h: h
          });
        } catch {
          try {
            image.resize(w, h);
          } catch {
            image.resize({
              width: w,
              height: h
            });
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
    configurable: true
  });
  return sock;
}

class Client extends EventEmitter {
  constructor(opts = {}, baileysOpts = {}) {
    super();
    this.opts = opts;
    this.baileysOpts = baileysOpts;
    process.nextTick(() => {
      this.init().catch(err => {
        console.error("Client init error:", err);
        if (global.waExclusive) process.exit(1);
      });
    });
  }
  async init() {
    global.settings = global.settings || {};
    global.settings.connection = global.settings.connection || {};
    global.settings.connection.use_pairing = this.opts.pairing ? this.opts.pairing.state : true;
    global.settings.connection.code_pairing = this.opts.pairing ? this.opts.pairing.code : "AKANOBOT";
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
      ...new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())
    };
    global.prefix = new RegExp("^[" + (global.opts["prefix"] || "xzXZ/i!#$%+£¢€¥^°=¶∆×÷π√©®:;?&.-").replace(/[|\\{}()[\]^$+*?.\-\^]/g, "\\$&") + "]");
    const database = require("../../../database");
    const db = {
      data: null,
      READ: false,
      read: async () => {
        db.data = database.get();
      },
      write: async () => {
        try {
          if (typeof database.flush === "function") {
            await database.flush();
          } else {
            const newData = await database.write(db.data);
            if (newData) db.data = newData;
          }
        } catch (e) {
          try {
            await database.write(db.data);
          } catch {}
        }
      },
      schedule: () => {
        try {
          database.scheduleAutosave?.();
        } catch {}
      }
    };
    global.db = db;
    global.DATABASE = db;
    global.loadDatabase = async function loadDatabase() {
      if (!db.READ) {
        setInterval(async () => {
          try {
            await db.write();
          } catch {}
        }, 3e5);
      }
      if (db.data !== null) return;
      db.READ = true;
      await db.read();
      db.READ = false;
      db.data = {
        users: {},
        chats: {},
        newsletters: [],
        telegram: {
          groups: {},
          users: {}
        },
        discord: {
          servers: {},
          users: {}
        },
        stats: {},
        msgs: {},
        sticker: {},
        settings: {},
        respon: {},
        texts: JSON.parse(JSON.stringify(require("../../../database").defaultTexts)),
        logerror: [],
        verifications: {},
        ...db.data || {}
      };
      db.chain = _.chain(db.data);
    };
    await global.loadDatabase();
    global.authFolder = global.settings.sessions || "sessions";
    if (!fs.existsSync("tmp")) fs.mkdirSync("tmp");
    if (!fs.existsSync(global.authFolder)) fs.mkdirSync(global.authFolder, {
      recursive: true
    });
    const logger = pino({
      level: "silent"
    });
    global.store = makeInMemoryStore({
      logger: logger
    });
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
    const {state: state, saveCreds: saveCreds} = await auth.initAuth(global.authFolder);
    const msgRetryCounterCache = new NodeCache;
    const version = undefined;
    let isInit = true;
    const handlerPath = path.join(__dirname, "..", "handler.js");
    let handler = require(handlerPath);
    const self = this;
    global.reloadHandler = async function(restartConn) {
      let Handler = require(handlerPath);
      if (Object.keys(Handler || {}).length) handler = Handler;
      const oldSock = global.sock;
      if (restartConn) {
        try {
          oldSock.ev.removeAllListeners();
          oldSock.ws.close();
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 3e3));
        const newRawSock = await socket.createSocket(state, logger, version, global.store, msgRetryCounterCache);
        global.store.bind(newRawSock.ev);
        global.sock = makeWASocket(newRawSock, global.store);
      }
      if (!isInit && oldSock) {
        if (typeof oldSock.handler === "function") {
          oldSock.ev.off("messages.upsert", oldSock.handler);
        }
        if (typeof oldSock.onPartsUpd === "function") {
          oldSock.ev.off("group-participants.update", oldSock.onPartsUpd);
        }
        if (typeof oldSock.onJrUpd === "function") {
          oldSock.ev.off("group.join-request", oldSock.onJrUpd);
        }
        if (typeof oldSock.credsUpdate === "function") {
          oldSock.ev.off("creds.update", oldSock.credsUpdate);
        }
      }
      global.sock.handler = handler.handler.bind(global.sock);
      global.sock.onPartsUpd = handler.participantsUpdate.bind(global.sock);
      global.sock.onJrUpd = handler.joinRequestUpdate.bind(global.sock);
      global.sock.credsUpdate = saveCreds.bind(global.sock);
      global.sock.ev.on("messages.upsert", global.sock.handler);
      global.sock.ev.on("group-participants.update", global.sock.onPartsUpd);
      global.sock.ev.on("group.join-request", global.sock.onJrUpd);
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
    this._registry = this._registry || new Map;
    this.proxy = proxy;
    this.adapter = adapter;
    const emitSugar = (event, data) => {
      try {
        self.emit(event, data);
        const handlers = self._registry.get(event);
        if (handlers) {
          handlers.slice().sort((a, b) => (b.priority || 0) - (a.priority || 0)).forEach(h => {
            try {
              h.handler(data);
            } catch (e) {
              console.error(`[Sugar:${event}]`, e.message);
            }
          });
        }
      } catch {}
    };
    this.register = (event, handler, priority = 0, isCore = false) => {
      if (typeof event !== "string" || typeof handler !== "function") return self;
      const key = event.trim();
      if (!self._registry.has(key)) self._registry.set(key, []);
      self._registry.get(key).push({
        handler: handler,
        priority: priority || 0,
        isCore: !!isCore
      });
      return self;
    };
    this._emitSugar = emitSugar;
    const bindSugarEvents = sockEv => {
      sockEv.on("connection.update", update => {
        const {connection: connection, lastDisconnect: lastDisconnect, qr: qr} = update;
        if (qr) {
          emitSugar("qr", qr);
          emitSugar("connection.qr", qr);
        }
        if (connection === "connecting") emitSugar("connecting", update);
        if (connection === "open") {
          emitSugar("connect", {
            sock: global.sock,
            update: update
          });
          emitSugar("ready", {
            sock: global.sock,
            update: update
          });
          emitSugar("open", update);
        }
        if (connection === "close") {
          emitSugar("close", update);
          emitSugar("disconnect", update);
          const err = lastDisconnect?.error;
          if (err) emitSugar("error", err);
        }
        emitSugar("connection.update", update);
      });
      sockEv.on("creds.update", creds => emitSugar("creds.update", creds));
      sockEv.on("messages.upsert", upsert => {
        emitSugar("messages.upsert", upsert);
        const {messages: messages, type: type} = upsert || {};
        if (type === "notify" && Array.isArray(messages)) {
          for (const raw of messages) {
            try {
              const m = serializeM(global.sock, raw);
              const ctx = {
                m: m,
                raw: raw,
                messages: messages,
                type: type,
                sock: global.sock,
                store: global.store
              };
              emitSugar("message", ctx);
              emitSugar("messages", ctx);
              if (m && m.mtype === "pollCreationMessage") emitSugar("poll", ctx);
            } catch {}
          }
        } else {
          emitSugar("message", upsert);
        }
      });
      sockEv.on("messages.update", updates => {
        emitSugar("messages.update", updates);
        emitSugar("message.update", updates);
        if (Array.isArray(updates)) {
          for (const u of updates) {
            if (u.update && u.update.pollUpdates) emitSugar("poll", u);
            if (u.update && u.update.message) emitSugar("message.edit", u);
          }
        }
      });
      sockEv.on("messages.delete", del => {
        emitSugar("messages.delete", del);
        emitSugar("message.delete", del);
      });
      sockEv.on("message-receipt.update", receipt => {
        emitSugar("message-receipt.update", receipt);
        emitSugar("receipt", receipt);
      });
      const reactHandler = reaction => {
        emitSugar("messages.reaction", reaction);
        emitSugar("message.reaction", reaction);
        emitSugar("reaction", reaction);
      };
      sockEv.on("messages.reaction", reactHandler);
      sockEv.on("message.reaction", reactHandler);
      sockEv.on("chats.update", chats => {
        emitSugar("chats.update", chats);
        emitSugar("chat.update", chats);
      });
      sockEv.on("chats.upsert", chats => emitSugar("chats.upsert", chats));
      sockEv.on("chats.delete", chats => emitSugar("chats.delete", chats));
      sockEv.on("contacts.update", contacts => {
        emitSugar("contacts.update", contacts);
        emitSugar("contact.update", contacts);
      });
      sockEv.on("contacts.upsert", contacts => {
        emitSugar("contacts.upsert", contacts);
        emitSugar("contact.upsert", contacts);
      });
      sockEv.on("groups.update", groups => {
        emitSugar("groups.update", groups);
        emitSugar("group.update", groups);
      });
      sockEv.on("group-participants.update", update => {
        emitSugar("group-participants.update", update);
        emitSugar("group participants.update", update);
        const {action: action, participants: participants} = update || {};
        const jid = update?.id;
        const ctx = {
          jid: jid,
          participants: participants,
          action: action,
          ...update,
          sock: global.sock
        };
        if (action === "add") {
          emitSugar("group.add", ctx);
          emitSugar("group.join", ctx);
        } else if (action === "remove") {
          emitSugar("group.remove", ctx);
          emitSugar("group.leave", ctx);
        } else if (action === "promote") {
          emitSugar("group.promote", ctx);
        } else if (action === "demote") {
          emitSugar("group.demote", ctx);
        }
      });
      sockEv.on("group.join-request", req => {
        emitSugar("group.join-request", req);
        emitSugar("group.join_request", req);
        emitSugar("join-request", req);
      });
      sockEv.on("presence.update", presence => {
        emitSugar("presence.update", presence);
        emitSugar("presence", presence);
      });
      const callHandler = call => {
        emitSugar("call", call);
        emitSugar("caller", call);
        const calls = Array.isArray(call) ? call : [ call ];
        for (const c of calls) {
          if (c && c.status === "offer") emitSugar("caller.offer", c);
        }
      };
      sockEv.on("call", callHandler);
      sockEv.on("CB:call", callHandler);
      sockEv.on("blocklist.update", bl => emitSugar("blocklist.update", bl));
      sockEv.on("blocklist.set", bl => emitSugar("blocklist.set", bl));
    };
    bindSugarEvents(global.sock.ev);
    const _origReload = global.reloadHandler;
    global.reloadHandler = async function(restartConn) {
      const res = await _origReload(restartConn);
      if (restartConn && global.sock && global.sock.ev) {
        self.ev = global.sock.ev;
        bindSugarEvents(global.sock.ev);
      }
      return res;
    };
    global.plugin = {};
    const scanDir = async dir => {
      let subdirs = await fs.promises.readdir(dir);
      let files = await Promise.all(subdirs.map(async subdir => {
        let res = path.resolve(dir, subdir);
        return (await fs.promises.stat(res)).isDirectory() ? scanDir(res) : res;
      }));
      return files.reduce((a, f) => a.concat(f), []);
    };
    try {
      const plugsPath = path.resolve(this.opts.plugsdir || path.join(__dirname, "..", "plugins"));
      let files = await scanDir(plugsPath);
      let plugin = {};
      for (let filename of files.map(a => a.replace(process.cwd(), ""))) {
        try {
          const fullPath = path.join(process.cwd(), filename);
          plugin[filename] = require(fullPath);
        } catch (e) {
          console.error(e);
        }
      }
      const watcher = chokidar.watch(plugsPath, {
        persistent: true,
        ignoreInitial: true
      });
      watcher.on("add", filename => {
        const rel = filename.replace(process.cwd(), "");
        plugin[rel] = require(filename);
      }).on("change", filename => {
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
      }).on("unlink", filename => {
        const rel = filename.replace(process.cwd(), "");
        delete plugin[rel];
      });
      plugin = Object.fromEntries(Object.entries(plugin).sort(([a], [b]) => a.localeCompare(b)));
      global.plugin = plugin;
    } catch (e) {
      console.error(e);
    }
    setInterval(async () => {
      try {
        const sessionDir = path.join(process.cwd(), global.authFolder);
        if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, {
          recursive: true
        });
        if (global.store.groupMetadata) {
          fs.writeFileSync(path.join(sessionDir, "store-group.json"), JSON.stringify(global.store.groupMetadata));
        }
        if (global.store.contacts) {
          fs.writeFileSync(path.join(sessionDir, "store-contacts.json"), JSON.stringify(global.store.contacts));
        }
        global.store.writeToFile(path.join(sessionDir, "store.json"));
      } catch (e) {}
    }, 3e5);
  }
}

module.exports = {
  Client: Client,
  makeWASocket: makeWASocket,
  serializeM: serializeM,
  smsg: smsg,
  utils: utils,
  auth: auth,
  adapter: adapter,
  proxy: proxy,
  socket: socket,
  events: events
};