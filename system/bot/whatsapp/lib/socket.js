const {
  default: makeWASocket,
  Browsers,
  makeCacheableSignalKeyStore,
  proto
} = require("baileys");
const readline = require("readline");

const getQrConfig = () => {
  const isMobile = process.stdout.columns < 80;
  return {
    small: isMobile,
    scale: isMobile ? 2 : 8,
    lineChar: isMobile ? "▄" : "█",
    spaceChar: isMobile ? " " : "░",
  };
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (text) =>
  new Promise((resolve) => rl.question(text, resolve));

async function createSocket(state, logger, version, store, msgRetryCounterCache) {
  const connSettings = global.settings.connection || {};
  const connectionOptions = {
    logger,
    printQRInTerminal: !connSettings.use_pairing,
    browser: Array.isArray(connSettings.browser)
      ? connSettings.browser
      : Browsers.ubuntu(connSettings.browser || "Chrome"),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    markOnlineOnConnect: connSettings.online !== false,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    appStateMacVerification: { patch: false, snapshot: false },
    keepAliveIntervalMs: 30000,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: undefined,
    shouldIgnoreJid: connSettings.shouldIgnoreJid,
    getMessage: async (key) => {
      if (store) {
        const msg = await store.loadMessage(key.remoteJid, key.id);
        return msg?.message || undefined;
      }
      return proto.Message.fromObject({});
    },
    msgRetryCounterCache,
    patchMessageBeforeSending: (msg) => {
      const isInteractive = !!(
        msg.buttonsMessage || msg.templateMessage || msg.listMessage ||
        msg.interactiveMessage || msg.nativeFlowMessage
      );
      if (isInteractive && !msg.viewOnceMessage) {
        msg = {
          viewOnceMessage: {
            message: {
              messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {} },
              ...msg,
            },
          },
        };
      }
      return msg;
    },
  };

  const sock = makeWASocket(connectionOptions);

  if (connSettings.use_pairing && !sock.authState.creds.registered) {
    let phoneNumber = connSettings.pairing_number;
    (async () => {
      if (!phoneNumber) {
        console.log("Enter WhatsApp number:");
        phoneNumber = await question("> ");
      }

      await new Promise((resolve) => {
        const checkConnected = (update) => {
          if (update.connection === "open" || update.qr) {
            sock.ev.off("connection.update", checkConnected);
            resolve();
          }
        };
        sock.ev.on("connection.update", checkConnected);
        setTimeout(() => {
          sock.ev.off("connection.update", checkConnected);
          resolve();
        }, 10000);
      });

      try {
        const code = await sock.requestPairingCode(
          phoneNumber,
          connSettings.code_pairing || "AKANOBOT"
        );
        console.log(`\n=============================`);
        console.log(`  PAIRING CODE: ${code?.match(/.{1,4}/g)?.join("-") || code}`);
        console.log(`  Enter this code in WhatsApp`);
        console.log(`  Settings > Linked Devices > Link with phone number`);
        console.log(`=============================\n`);
      } catch (err) {
        console.error("Failed to request pairing code:", err.message);
      }
    })().catch((err) => {
      console.error("Pairing task error:", err.message);
    });
  }

  return sock;
}

module.exports = { createSocket, getQrConfig };
