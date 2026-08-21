const {
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  downloadMediaMessage,
} = require("baileys");
const { Boom } = require("@hapi/boom");
const qrcode = require("qrcode-terminal");
const moment = require("moment-timezone");
const gradient = require("gradient-string");
const path = require("path");
const fs = require("fs");
const { createWriteStream } = require("fs");
const { getQrConfig } = require("./socket");
const { initSystem, antiDel, delHandler } = require("./system-handler");
const { AutoBackup } = require("./backup");

const infoGradient = gradient(["#00F5A0", "#00D9F5"]);
const errorGradient = gradient(["#FF0000", "#FF7F7F"]);
const warnGradient = gradient(["#FFD700", "#FFA500"]);

let rcTries = 0;
let rcTimer = null;
let isReconnecting = false;
let watchdogTimer = null;
let _forceReconnect = false;
let lastRcAt = Date.now();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let _origInfo = null;
let _origError = null;
let hbBound = false;

function onUE(err) {
  if (isBaileysInternalError(err)) {
    noteErr("Ignored", err.message);
  }
}

function onUHRej(reason) {
  if (isBaileysInternalError(reason)) {
    noteErr("Ignored", reason?.message);
  }
}

function formatDuration(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`;
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

const RST_WIN = 5 * 60 * 1000;
const MAX_RST = 5;
let restartCount = 0;

const BAILEYS_STACK_MARKERS = ["/baileys/", "@whiskeysockets/baileys", "/baileys-caller/"];
const IGNORED_ERRORS = [
  "isZero",
  "toJSON",
  "writeToFile",
  "reading 'child'",
  "makeNoiseHandler",
  "Cannot read properties of undefined",
  "noise-handler",
  "socket.js",
  "Stream Errored",
  "Connection Closed",
  "Bad MAC",
  "Failed to decrypt",
];

function isBaileysInternalError(err) {
  if (!err) return false;
  const stack = err.stack || "";
  const isFromBaileys = BAILEYS_STACK_MARKERS.some((m) => stack.includes(m));
  if (!isFromBaileys) return false;
  const msg = err.message || "";
  return IGNORED_ERRORS.some((e) => msg.includes(e) || stack.includes(e));
}

let errSeen = [];
const ERR_WIN_MS = 60 * 1000;
const IGNORED_ERROR_THRESHOLD = 5;

function noteErr(label, msg) {
  const now = Date.now();
  errSeen.push(now);
  errSeen = errSeen.filter((t) => now - t <= ERR_WIN_MS);
  if (errSeen.length >= IGNORED_ERROR_THRESHOLD) {
    console.error(
      warnGradient(
        `Watchdog: ${errSeen.length}x errors in ${ERR_WIN_MS / 1000}s — forcing restart`,
      ),
    );
    errSeen = [];
    _forceReconnect = true;
  }
}

function dbRc(fn) {
  if (rcTimer) clearTimeout(rcTimer);
  rcTimer = setTimeout(fn, 2500);
}

function bindEvents(sock, store, saveCreds, reloadHandler, statusPath, logger) {
  if (_origInfo) console.info = _origInfo;
  if (_origError) console.error = _origError;

  const _info = console.info;
  console.info = (...a) => {
    const s = typeof a[0] === "string" ? a[0] : "";
    if (s.includes("Closing session") || s.includes("SessionEntry") || s.includes("decryption"))
      return;
    _info.apply(console, a);
  };
  _origInfo = _info;

  const _err = console.error;
  console.error = (...a) => {
    const s = typeof a[0] === "string" ? a[0] : "";
    if (s.includes("Bad MAC") || s.includes("Failed to decrypt") || s.includes("Stream Errored")) {
      _forceReconnect = true;
      return;
    }
    if (
      s.includes("MessageCounterError") ||
      s.includes("Key used already or never filled") ||
      s.includes("Failed to decrypt message with any known session") ||
      s.includes("No matching sessions found")
    ) {
      return;
    }
    _err.apply(console, a);
  };
  _origError = _err;

  if (!hbBound) {
    process.setMaxListeners(25);
    process.removeListener("uncaughtException", onUE);
    process.on("uncaughtException", onUE);
    process.removeListener("unhandledRejection", onUHRej);
    process.on("unhandledRejection", onUHRej);
    hbBound = true;
  }

  if (sock.__akanoEventsBound) return;
  sock.__akanoEventsBound = true;

  sock.ev.on("qr", (qr) => {
    if (!global.settings.connection.use_pairing) {
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
        console.log(infoGradient(` Scan before ${moment().add(20, "seconds").format("HH:mm:ss")}`));
      });
    }
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, isNewLogin } = update;
    global.stopped = connection;
    if (isNewLogin) sock.isInit = true;

    if (connection === "open") {
      rcTries = 0;
      restartCount = 0;
      _forceReconnect = false;
      lastRcAt = Date.now();
      console.log(
        infoGradient(
          `Logged in via ${global.settings.connection.use_pairing ? "PAIRING" : "QR"} | ${sock.user.id.split(":")[0]}`,
        ),
      );
      if (global.settings.connection?.presence) {
        await sock.sendPresenceUpdate("available").catch(() => {});
      }
      if (watchdogTimer) clearInterval(watchdogTimer);
      watchdogTimer = setInterval(() => {
        if (_forceReconnect) {
          _forceReconnect = false;
          console.log(errorGradient("Session corrupt, reconnecting..."));
          clearInterval(watchdogTimer);
          watchdogTimer = null;
          dbRc(() => reloadHandler(true));
        }
      }, 5000);
      const RAM_LIMIT = 900 * 1024 * 1024;
      const ramCheck = setInterval(() => {
        const ramUsage = process.memoryUsage().rss;
        if (ramUsage >= RAM_LIMIT) {
          clearInterval(ramCheck);
          console.error(
            errorGradient(`RAM ${Math.round(ramUsage / 1024 / 1024)}MB > 900MB! Restarting...`),
          );
          if (global.waExclusive) process.exit(1);
        }
      }, 60000);
      initSystem(sock, global);
      const dbFile =
        global.dbFile ||
        path.join(process.cwd(), global.settings?.dataname || "system/database/database.json");
      const autoBackup = new AutoBackup(dbFile, 3600000);
      autoBackup.start();
      global.autoBackup = autoBackup;
      if (global.db && !global.db.afk) global.db.afk = {};
      if (global.db && !global.db.groups) global.db.groups = [];
      if (global.db && !global.db.users) global.db.users = [];
      sock.ev.on("presence.update", (update) => {
        if (!update || !global.db) return;
        const { id, presences } = update;
        if (!id || typeof id !== "string" || !id.endsWith("g.us")) return;
        for (let sender in presences) {
          let user = global.db.users?.find?.((v) => v.jid === sender);
          const presence = presences[sender];
          if (!presence || !user) continue;
          if (
            (presence.lastKnownPresence === "composing" ||
              presence.lastKnownPresence === "recording") &&
            user.afk > -1
          ) {
            const duration = Date.now() - (user.afk || 0);
            const reason = user.afkReason || "-";
            sock.reply(
              id,
              `@${sender.split("@")[0]} active after AFK for ${formatDuration(duration)}\nReason: ${reason}`,
              { mentions: [sender] },
            );
            user.afk = -1;
            user.afkReason = "";
          }
        }
      });
    }

    if (connection === "close") {
      if (watchdogTimer) {
        clearInterval(watchdogTimer);
        watchdogTimer = null;
      }
      if (isReconnecting) return;
      isReconnecting = true;

      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const isPairing = global.settings.connection?.use_pairing;
      const credsRegistered = sock.authState?.creds?.registered;

      if (isPairing && !credsRegistered) {
        console.log(errorGradient("Session not registered. Waiting for pairing..."));
        isReconnecting = false;
        return;
      }

      if (reason === DisconnectReason.loggedOut) {
        console.log(errorGradient("Logged out. Session invalidated."));
        console.log(errorGradient("Delete sessions/ folder and restart to re-pair."));
        isReconnecting = false;
        return;
      }

      if (reason === DisconnectReason.restartRequired) {
        console.log(infoGradient("Restarting..."));
        isReconnecting = false;
        dbRc(() => reloadHandler(true));
        return;
      }

      const now = Date.now();
      if (now - lastRcAt > RST_WIN) restartCount = 0;
      restartCount++;
      lastRcAt = now;

      if (restartCount > MAX_RST) {
        const delay = Math.min(60000, restartCount * 5000);
        console.error(
          warnGradient(`Too many restarts (${restartCount}x). Waiting ${delay / 1000}s...`),
        );
        await sleep(delay);
        isReconnecting = false;
        dbRc(() => reloadHandler(true));
        return;
      }

      const delay = Math.min(3000 * Math.pow(2, rcTries), 60000);
      rcTries++;
      console.log(errorGradient(`Disconnected (${reason}). Reconnecting in ${delay / 1000}s...`));
      await sleep(delay);
      isReconnecting = false;
      dbRc(() => reloadHandler(true));
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("contacts.update", (update) => {
    for (let contact of update) {
      let id = jidNormalizedUser(contact.id);
      if (store && store.contacts) {
        store.contacts[id] = {
          ...(store.contacts?.[id] || {}),
          ...(contact || {}),
        };
      }
    }
  });

  sock.ev.on("contacts.upsert", (update) => {
    for (let contact of update) {
      let id = jidNormalizedUser(contact.id);
      if (store && store.contacts) {
        store.contacts[id] = { ...(contact || {}), isContact: true };
      }
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

  sock.ev.on("messages.upsert", (update) => {
    antiDel(sock, update, global);
  });

  sock.ev.on("messages.delete", (update) => {
    delHandler(sock, update, global);
  });

  sock.ev.on("group-participants.update", async (update) => {
    const { id, participants, action } = update;
    const groupSet = global.db?.data?.chats?.[id];
    if (!groupSet) return;

    if (action === "promote" || action === "demote") {
      const metadata = store.groupMetadata[id];
      if (metadata?.participants) {
        for (const participant of participants) {
          const pid =
            typeof participant === "string"
              ? participant
              : participant?.id || participant?.phoneNumber || "";
          const mem = jidNormalizedUser(pid);
          const p = metadata.participants.find((u) => jidNormalizedUser(u.id) === mem);
          if (p) {
            p.admin = action === "promote" ? "admin" : null;
          }
        }
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

        if (global.settings.reactSW && global.settings.emojis && global.settings.emojis.length) {
          const randomEmoji =
            global.settings.emojis[Math.floor(Math.random() * global.settings.emojis.length)];
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
          let contentType = getContentType(msg.message);
          if (contentType === "extendedTextMessage") {
            global.status.push({
              jid,
              name,
              text: msg.message.extendedTextMessage.text,
              time: Date.now(),
            });
          } else if (
            contentType === "imageMessage" ||
            contentType === "videoMessage" ||
            contentType === "audioMessage"
          ) {
            const mediaObj = msg.message[contentType];
            const stream = await downloadMediaMessage(
              msg,
              "stream",
              {},
              {
                logger,
                reuploadRequest: sock.updateMediaMessage,
              },
            );
            const randomID = (length) =>
              require("crypto")
                .randomBytes(Math.ceil(length * 0.5))
                .toString("hex")
                .slice(0, length);
            const fileName = `${randomID(10)}.${mediaObj.mimetype.split("/")[1]}`;
            const filePath = path.join(__dirname, "..", "..", "tmp", fileName);
            const writeStream = createWriteStream(filePath);
            stream.pipe(writeStream);

            await new Promise((resolve) => {
              writeStream.on("finish", () => {
                const base64 = fs.readFileSync(filePath).toString("base64");
                global.status.push({
                  jid,
                  name,
                  type: contentType,
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
        } catch (error) {}
      }
    }
  });
}

module.exports = { bindEvents };
