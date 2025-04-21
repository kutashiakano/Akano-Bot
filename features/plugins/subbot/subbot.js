const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
} = require("baileys");
const NodeCache = require("node-cache");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const pino = require("pino");
const { makeWASocket } = require("../../../lib/simple.js");

if (!global.socks) global.socks = [];
const logger = pino({ level: "silent" });

if (global.settings.subbot.AutoConnect) {
  autoConnectSessions();
}

async function autoConnectSessions() {
  const sessionDir = `./${global.settings.subbot.sessionbot}`;
  if (!fs.existsSync(sessionDir)) return;
  const sessionFolders = fs
    .readdirSync(sessionDir)
    .filter((f) => fs.statSync(path.join(sessionDir, f)).isDirectory());
  for (const folder of sessionFolders) {
    const sessionPath = path.join(sessionDir, folder);
    await initializeSession(sessionPath);
  }
}

async function initializeSession(sessionPath) {
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  if (!state.creds.registered) return;
  const msgRetryCounterCache = new NodeCache();
  const { version } = await fetchLatestBaileysVersion();

  const connectionOptions = {
    logger,
    printQRInTerminal: false,
    browser: Browsers.windows("Safari"),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(
        state.keys,
        pino({ level: "fatal" }).child({ level: "fatal" }),
      ),
    },
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    msgRetryCounterCache,
    defaultQueryTimeoutMs: undefined,
    version,
  };

  let sock = makeWASocket(connectionOptions);
  sock.isInit = false;
  let isInit = true;

  async function connectionUpdate(update) {
    const { connection, lastDisconnect, isNewLogin } = update;
    if (isNewLogin) sock.isInit = true;
    const code = lastDisconnect?.error?.output?.statusCode;
    if (
      code &&
      code !== DisconnectReason.loggedOut &&
      sock?.ws.socket == null
    ) {
      let i = global.socks.indexOf(sock);
      if (i < 0) {
        await handler.setupEvents(true);
        return;
      }
      delete global.socks[i];
      global.socks.splice(i, 1);
      if (code !== DisconnectReason.connectionClosed) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
    }
    if (connection === "open") {
      sock.isInit = true;
      sock.connectTime = new Date();
      sock.authFolder = path.basename(sessionPath);
      global.socks.push(sock);
    }
    if (code === DisconnectReason.loggedOut) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
  }

  const handler = {
    async setupEvents(restartConn) {
      if (restartConn) {
        sock.ws.close();
        sock.ev.removeAllListeners();
        sock = makeWASocket(connectionOptions);
        isInit = true;
      }
      if (!isInit) {
        sock.ev.off("messages.upsert", sock.handler);
        sock.ev.off("connection.update", sock.connectionUpdate);
        sock.ev.off("creds.update", sock.credsUpdate);
      }
      const handler = require("../../handler.js");
      sock.handler = handler.handler.bind(sock);
      sock.connectionUpdate = connectionUpdate.bind(sock);
      sock.credsUpdate = saveCreds.bind(sock, true);
      sock.ev.on("messages.upsert", sock.handler);
      sock.ev.on("connection.update", sock.connectionUpdate);
      sock.ev.on("creds.update", sock.credsUpdate);
      isInit = false;
    },
  };

  await handler.setupEvents(false);
}

module.exports = {
  help: ["jadibot"],
  command: ["jadibot"],
  tags: ["subbot"],
  private: true,
  run: async (m, { sock: _sock, usedPrefix, command, args }) => {
    const __sock = await global.sock;
    if (!(args[0] === "plz" || __sock.user.jid === _sock.user.jid)) {
      return m.reply(
        `This command can only be used on the main bot! wa.me/${__sock.user.jid.split("@")[0]}?text=${usedPrefix}${command}`,
      );
    }

    const handler = {
      async initializeBot() {
        let authFolderB = crypto.randomBytes(10).toString("hex").slice(0, 8);
        const sessionPath = `./${global.settings.subbot.sessionbot}/${authFolderB}`;
        fs.mkdirSync(sessionPath, { recursive: true });
        if (args[0]) {
          fs.writeFileSync(
            `${sessionPath}/creds.json`,
            JSON.stringify(
              JSON.parse(Buffer.from(args[0], "base64").toString("utf-8")),
              null,
              "\t",
            ),
          );
        }
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const msgRetryCounterCache = new NodeCache();
        const { version } = await fetchLatestBaileysVersion();
        const phoneNumber = m.sender.split("@")[0];
        const connectionOptions = {
          logger: pino({ level: "silent" }),
          printQRInTerminal: false,
          browser: Browsers.windows("Safari"),
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(
              state.keys,
              pino({ level: "fatal" }).child({ level: "fatal" }),
            ),
          },
          markOnlineOnConnect: true,
          generateHighQualityLinkPreview: true,
          msgRetryCounterCache,
          defaultQueryTimeoutMs: undefined,
          version,
        };
        let sock = makeWASocket(connectionOptions);
        let disconnectTimeout;
        if (!sock.authState.creds.registered) {
          if (!phoneNumber) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            return;
          }
          const cleanedNumber = phoneNumber.replace(/[^0-9]/g, "");
          if (cleanedNumber.length < 10) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            return;
          }
          setTimeout(async () => {
            const randomPairing = Array.from(
              { length: 8 },
              () =>
                "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[
                  Math.floor(Math.random() * 36)
                ],
            ).join("");
            const codeBot = await sock.requestPairingCode(
              cleanedNumber,
              randomPairing,
            );
            const formattedCode =
              codeBot?.match(/.{1,4}/g)?.join("-") || codeBot;
            const txt = `WhatsApp Pairing Code\n\n${formattedCode}\n\nSteps:\n1. Open WhatsApp > Linked Devices\n2. Tap 'Link a Device'\n3. Enter code\n\nExpires in 20 seconds`;
            await __sock.reply(m.chat, txt, m);
          }, 3000);
        }
        sock.isInit = false;
        let isInit = true;
        const connectionHandler = {
          async update(update) {
            const { connection, lastDisconnect, isNewLogin } = update;
            if (isNewLogin) sock.isInit = true;
            const code = lastDisconnect?.error?.output?.statusCode;
            if (
              code &&
              code !== DisconnectReason.loggedOut &&
              sock?.ws.socket == null
            ) {
              let i = global.socks.indexOf(sock);
              if (i < 0) {
                await eventHandler.setup(true);
                return;
              }
              delete global.socks[i];
              global.socks.splice(i, 1);
              if (!disconnectTimeout) {
                disconnectTimeout = setTimeout(() => {
                  fs.rmSync(sessionPath, { recursive: true, force: true });
                }, 60000);
              }
            }
            if (connection === "open") {
              sock.isInit = true;
              sock.connectTime = new Date();
              sock.authFolder = authFolderB;
              global.socks.push(sock);
              if (disconnectTimeout) {
                clearTimeout(disconnectTimeout);
                disconnectTimeout = null;
              }
              await __sock.reply(
                m.chat,
                "Successfully connected to WhatsApp",
                m,
              );
            }
            if (code === DisconnectReason.loggedOut) {
              fs.rmSync(sessionPath, { recursive: true, force: true });
            }
          },
        };
        const eventHandler = {
          async setup(restartConn) {
            if (restartConn) {
              sock.ws.close();
              sock.ev.removeAllListeners();
              sock = makeWASocket(connectionOptions);
              isInit = true;
            }
            if (!isInit) {
              sock.ev.off("messages.upsert", sock.handler);
              sock.ev.off("connection.update", sock.connectionUpdate);
              sock.ev.off("creds.update", sock.credsUpdate);
            }
            const handler = require("../../handler.js");
            sock.handler = handler.handler.bind(sock);
            sock.connectionUpdate = connectionHandler.update.bind(sock);
            sock.credsUpdate = saveCreds.bind(sock, true);
            sock.ev.on("messages.upsert", sock.handler);
            sock.ev.on("connection.update", sock.connectionUpdate);
            sock.ev.on("creds.update", sock.credsUpdate);
            isInit = false;
          },
        };
        await eventHandler.setup(false);
      },
    };
    await handler.initializeBot();
  },
};
