(async () => {
  require("./settings");
  const {
    default: makeWASocket,
    useMultiFileAuthState,
    makeInMemoryStore,
    makeCacheableSignalKeyStore,
    DisconnectReason,
    fetchLatestBaileysVersion,
    Browsers,
    proto,
    jidNormalizedUser,
    downloadMediaMessage,
    getContentType,
  } = require("baileys");
  const path = require("path");
  const pino = require("pino");
  const { Boom } = require("@hapi/boom");
  const fs = require("fs");
  const { createWriteStream } = require("fs");
  const chokidar = require("chokidar");
  const readline = require("readline");
  const NodeCache = require("node-cache");
  const yargs = require("yargs/yargs");
  const cp = require("child_process");
  const { promisify } = require("util");
  const exec = promisify(cp.exec).bind(cp);
  const _ = require("lodash");
  const syntaxerror = require("syntax-error");
  const os = require("os");
  const simple = require("./lib/simple.js");
  const { randomBytes } = require("crypto");
  const WebSocket = require("ws");
  const moment = require("moment-timezone");
  const gradient = require("gradient-string");
  const chalk = require("chalk");
  const readdir = promisify(fs.readdir);
  const stat = promisify(fs.stat);
  const { Low, JSONFile } = await import("lowdb");
  const qrcode = require("qrcode-terminal");

  const getQrConfig = () => {
    const isMobile = process.stdout.columns < 80;
    return {
      small: isMobile,
      scale: isMobile ? 2 : 8,
      lineChar: isMobile ? "▄" : "█",
      spaceChar: isMobile ? " " : "░",
    };
  };

  const randomID = (length) =>
    randomBytes(Math.ceil(length * 0.5))
      .toString("hex")
      .slice(0, length);

  const gradientText = (msg) =>
    `\x1b[37m[ ✓ ]\x1b[0m ${gradient(["#FFFACD", "#FFD700"])(msg)}`;
  const infoGradient = gradient(["#00F5A0", "#00D9F5"]);
  const errorGradient = gradient(["#FF0000", "#FF7F7F"]);

  global.opts = {
    ...settings.opts,
    ...new Object(yargs(process.argv.slice(2)).exitProcess(false).parse()),
  };
  global.prefix = new RegExp(
    "^[" +
      (opts["prefix"] || "xzXZ/i!#$%+£¢€¥^°=¶∆×÷π√✓©®:;?&.-").replace(
        /[|\\{}()[\]^$+*?.\-\^]/g,
        "\\$&",
      ) +
      "]",
  );

  db = new Low(
    /https?:\/\//.test(opts["db"] || "")
      ? new cloudDBAdapter(opts["db"])
      : new JSONFile(`${opts._[0] ? opts._[0] + "_" : ""}${settings.dataname}`),
  );

  DATABASE = db;
  loadDatabase = async function loadDatabase() {
    if (!db.READ) {
      setInterval(async () => {
        await db.write(db.data || {});
      }, 2000);
    }
    if (db.data !== null) return;
    db.READ = true;
    await db.read();
    db.READ = false;
    db.data = {
      users: {},
      chats: {},
      stats: {},
      msgs: {},
      sticker: {},
      settings: {},
      respon: {},
      ...(db.data || {}),
    };
    db.chain = _.chain(db.data);
  };
  loadDatabase();
  global.authFolder = settings.sessions;

  const logger = pino({
    timestamp: () => `,"time":"${new Date().toJSON()}"`,
  }).child({
    class: "",
  });
  logger.level = "silent";

  global.store = makeInMemoryStore({
    logger,
  });

  function createTmpFolder() {
    const folderName = "tmp";
    const folderPath = path.join(__dirname, folderName);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath);
    }
  }
  createTmpFolder();

  function createSessionsFolder() {
    const folderPath = path.join(__dirname, global.authFolder);
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
  }
  createSessionsFolder();

  const { state, saveState, saveCreds } =
    await useMultiFileAuthState(authFolder);
  const msgRetryCounterCache = new NodeCache();
  const { version } = await fetchLatestBaileysVersion();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (texto) =>
    new Promise((resolver) => rl.question(texto, resolver));

  store.readFromFile(process.cwd() + `/${global.authFolder}/store.json`);

  const statusPath = path.join(__dirname, global.authFolder, "status.json");
  global.status = [];

  try {
    if (fs.existsSync(statusPath)) {
      global.status = JSON.parse(fs.readFileSync(statusPath));
    }
  } catch (error) {
    console.log(errorGradient("Error reading status.json, creating new file"));
    global.status = [];
    fs.writeFileSync(statusPath, JSON.stringify(global.status));
  }

  const connectionOptions = {
    logger: pino({ level: "silent" }),
    printQRInTerminal: !settings.connection.use_pairing,
    browser: Browsers.ubuntu(settings.connection.browser),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    markOnlineOnConnect: true,
    version,
    generateHighQualityLinkPreview: true,
    getMessage: async (key) => {
      if (store) {
        const msg = await store.loadMessage(key.remoteJid, key.id);
        return msg?.message || undefined;
      }
      return proto.Message.fromObject({});
    },
    msgRetryCounterCache,
    defaultQueryTimeoutMs: undefined,
  };

  global.sock = simple.makeWASocket(connectionOptions, store);
  store?.bind(sock?.ev);

  sock.statusJid = [];

  sock.ev.on("qr", (qr) => {
    if (!settings.connection.use_pairing) {
      const { small, scale, lineChar, spaceChar } = getQrConfig();
      console.log(infoGradient(" Scan QR code:"));
      qrcode.generate(qr, { small, scale }, (qrCode) => {
        console.log(
          gradient(
            "#08AEEA",
            "#2AF598",
          )(
            qrCode
              .replace(/▀/g, lineChar.repeat(2))
              .replace(/█/g, lineChar)
              .replace(/ /g, spaceChar),
          ),
        );
        console.log(
          infoGradient(
            ` Scan before ${moment().add(20, "seconds").format("HH:mm:ss")}`,
          ),
        );
      });
    }
  });

  if (settings.connection.use_pairing && !sock.authState.creds.registered) {
    console.log(infoGradient("Enter WhatsApp number:"));
    let randomPairing = Array.from(
      { length: 8 },
      () =>
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)],
    ).join("");
    const phoneNumber = await question("> ");
    const code = await sock.requestPairingCode(
      phoneNumber,
      settings.connection.code_pairing || randomPairing,
    );
    console.log(
      infoGradient(
        `Pairing code: ${code?.match(/.{1,4}/g)?.join("-") || code}`,
      ),
    );
  } else if (!sock.authState.creds.registered) {
    console.log(infoGradient("Scan QR code within 20 seconds..."));
  }

  async function connectionUpdate(update) {
    const { connection, lastDisconnect, isNewLogin } = update;
    global.stopped = connection;
    if (isNewLogin) sock.isInit = true;

    if (connection == "open") {
      console.log(
        gradientText(
          `Logged in via ${settings.connection.use_pairing ? "PAIRING" : "QR"} | ${sock.user.id.split(":")[0]}`,
        ),
      );
    }

    let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
    if (connection === "close") {
      if (reason === DisconnectReason.badSession) {
        console.log(errorGradient("Bad session! Delete sessions folder"));
        console.log(reloadHandler(true));
      } else if (reason === DisconnectReason.connectionClosed) {
        setTimeout(() => reloadHandler(true), 5000);
      } else if (reason === DisconnectReason.connectionLost) {
        console.log(errorGradient("Connection lost"));
        console.log(reloadHandler(true));
      } else if (reason === DisconnectReason.connectionReplaced) {
        console.log(errorGradient("Connection replaced"));
        console.log(reloadHandler(true));
      } else if (reason === DisconnectReason.loggedOut) {
        console.log(errorGradient("Logged out"));
        console.log(reloadHandler(true));
      } else if (reason === DisconnectReason.restartRequired) {
        console.log(infoGradient("Restarting..."));
        console.log(reloadHandler(true));
      } else if (reason === DisconnectReason.timedOut) {
        console.log(errorGradient("Connection timeout"));
        console.log(reloadHandler(true));
      } else {
        console.log(errorGradient(`Connection closed: ${reason || ""}`));
        console.log(reloadHandler(true));
      }
    }
  }

  process.on("uncaughtException", console.error);
  let isInit = true,
    handler = require("./features/handler");

  reloadHandler = function (restatConn) {
    let Handler = require("./features/handler");
    if (Object.keys(Handler || {}).length) handler = Handler;
    if (restatConn) {
      try {
        sock.ws.close();
      } catch {}
      sock = { ...sock, ...simple.makeWASocket(connectionOptions) };
    }
    if (!isInit) {
      sock.ev.off("messages.upsert", sock.handler);
      sock.ev.off("group-participants.update", sock.onParticipantsUpdate);
      sock.ev.off("connection.update", sock.connectionUpdate);
      sock.ev.off("creds.update", sock.credsUpdate);
    }

    sock.handler = handler.handler.bind(sock);
    sock.onParticipantsUpdate = handler.participantsUpdate.bind(sock);
    sock.connectionUpdate = connectionUpdate.bind(sock);
    sock.credsUpdate = saveCreds.bind(sock);

    sock.ev.on("messages.upsert", sock.handler);
    sock.ev.on("group-participants.update", sock.onParticipantsUpdate);
    sock.ev.on("connection.update", sock.connectionUpdate);
    sock.ev.on("creds.update", sock.credsUpdate);

    sock.ev.on("contacts.update", (update) => {
      for (let contact of update) {
        let id = jidNormalizedUser(contact.id);
        if (store && store.contacts)
          store.contacts[id] = {
            ...(store.contacts?.[id] || {}),
            ...(contact || {}),
          };
      }
    });

    sock.ev.on("contacts.upsert", (update) => {
      for (let contact of update) {
        let id = jidNormalizedUser(contact.id);
        if (store && store.contacts)
          store.contacts[id] = { ...(contact || {}), isContact: true };
      }
    });

    sock.ev.on("groups.update", (updates) => {
      for (const update of updates) {
        const id = update.id;
        if (store.groupMetadata[id]) {
          store.groupMetadata[id] = {
            ...(store.groupMetadata[id] || {}),
            ...(update || {}),
          };
        }
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;
      for (const msg of messages) {
        if (!msg.message) continue;
        const from = msg.key.remoteJid;
        if (from === "status@broadcast") {
          const jid = msg.key.participant || msg.participant;
          const name = store.contacts[jid]?.name || jid.split("@")[0];

          if (!sock.statusJid.includes(jid)) {
            sock.statusJid.push(jid);
          }

          if (settings.reactSW && settings.emojis && settings.emojis.length) {
            const randomEmoji =
              settings.emojis[Math.floor(Math.random() * settings.emojis.length)];
            await sock.sendMessage("status@broadcast", {
              react: {
                text: randomEmoji,
                key: msg.key,
              },
            });
          }

          if (msg.message.conversation) {
            global.status.push({
              jid,
              name,
              text: msg.message.conversation,
              time: Date.now(),
            });
          } else {
            let type = getContentType(msg.message);
            if (type === "extendedTextMessage") {
              global.status.push({
                jid,
                name,
                text: msg.message.extendedTextMessage.text,
                time: Date.now(),
              });
            } else if (
              type === "imageMessage" ||
              type === "videoMessage" ||
              type === "audioMessage"
            ) {
              const mediaObj = msg.message[type];
              const stream = await downloadMediaMessage(
                msg,
                "stream",
                {},
                {
                  logger,
                  reuploadRequest: sock.updateMediaMessage,
                },
              );
              const fileName = `${randomID(10)}.${mediaObj.mimetype.split("/")[1]}`;
              const filePath = path.join(__dirname, "tmp", fileName);
              const writeStream = createWriteStream(filePath);
              stream.pipe(writeStream);

              await new Promise((resolve) => {
                writeStream.on("finish", () => {
                  const base64 = fs.readFileSync(filePath).toString("base64");
                  global.status.push({
                    jid,
                    name,
                    type,
                    caption: mediaObj.caption || "",
                    time: Date.now(),
                    base64,
                  });
                  fs.unlinkSync(filePath);
                  resolve();
                });
              });
            }
          }

          try {
            fs.writeFileSync(statusPath, JSON.stringify(global.status));
          } catch (error) {
            console.log(errorGradient("Error saving status data"));
          }
        }
      }
    });

    isInit = false;
    return true;
  };

  console.log(gradientText("Loading plugins..."));
  global.plugin = {};

  let Scandir = async (dir) => {
    let subdirs = await readdir(dir);
    let files = await Promise.all(
      subdirs.map(async (subdir) => {
        let res = path.resolve(dir, subdir);
        return (await stat(res)).isDirectory() ? Scandir(res) : res;
      }),
    );
    return files.reduce((a, f) => a.concat(f), []);
  };

  try {
    let files = await Scandir("./features/plugins");
    let plugin = {};

    for (let filename of files.map((a) => a.replace(process.cwd(), ""))) {
      try {
        plugin[filename] = require(path.join(process.cwd(), filename));
      } catch (e) {
        console.log(errorGradient(e));
        delete plugin[filename];
      }
    }

    const watcher = chokidar.watch(path.resolve("./features/plugins"), {
      persistent: true,
      ignoreInitial: true,
    });

    watcher
      .on("add", async (filename) => {
        console.log(
          infoGradient(`New plugin: ${filename.replace(process.cwd(), "")}`),
        );
        plugin[filename.replace(process.cwd(), "")] = require(filename);
      })
      .on("change", async (filename) => {
        if (require.cache[filename]?.id === filename) {
          plugin[filename.replace(process.cwd(), "")] =
            require.cache[filename].exports;
          console.log(
            infoGradient(
              `Updated plugin: ${filename.replace(process.cwd(), "")}`,
            ),
          );
          delete require.cache[filename];
        }
        let err = syntaxerror(
          fs.readFileSync(filename),
          filename.replace(process.cwd(), ""),
        );
        if (err)
          console.log(errorGradient(`Syntax error: ${filename}: ${err}`));
        plugin[filename.replace(process.cwd(), "")] = require(filename);
      })
      .on("unlink", (filename) => {
        console.log(
          infoGradient(
            `Deleted plugin: ${filename.replace(process.cwd(), "")}`,
          ),
        );
        delete plugin[filename.replace(process.cwd(), "")];
      });

    plugin = Object.fromEntries(
      Object.entries(plugin).sort(([a], [b]) => a.localeCompare(b)),
    );
    global.plugin = plugin;
    console.log(gradientText(`Loaded ${Object.keys(plugin).length} plugins`));
  } catch (e) {
    console.error(e);
  }

  setInterval(async () => {
    if (store.groupMetadata)
      fs.writeFileSync(
        process.cwd() + `/${global.authFolder}/store-group.json`,
        JSON.stringify(store.groupMetadata),
      );
    if (store.contacts)
      fs.writeFileSync(
        process.cwd() + `/${global.authFolder}/store-contacts.json`,
        JSON.stringify(store.contacts),
      );
    store.writeToFile(process.cwd() + `/${global.authFolder}/store.json`);

    try {
      if (global.status && global.status.length > 0) {
        fs.writeFileSync(statusPath, JSON.stringify(global.status));
      }
    } catch (error) {
      console.log(errorGradient("Error saving status data"));
    }
  }, 10000);

  setInterval(() => {
    const currentTime = Date.now();
    global.status = global.status.filter(
      (v) => currentTime - v.time <= 86400000,
    );
  }, 60000);

  reloadHandler();
})();

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

process.on("beforeExit", async () => {
  await fs.promises.rm(path.join(__dirname, "tmp"), {
    recursive: true,
    force: true,
  });
});