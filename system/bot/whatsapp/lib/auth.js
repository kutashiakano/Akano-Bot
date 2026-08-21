const { useMultiFileAuthState } = require("baileys");
const fs = require("fs");
const path = require("path");

async function initAuth(authFolder) {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    const origCreds = saveCreds;
    state.saveCreds = async () => {
      try {
        await origCreds();
      } catch (err) {
        if (err.code === "EPERM" || err.code === "EBUSY") {
          console.log("[Auth] EPERM on saveCreds, retrying in 1s...");
          await new Promise((r) => setTimeout(r, 1000));
          try {
            await origCreds();
          } catch (retryErr) {
            console.error("[Auth] Retry also failed:", retryErr.message);
          }
        } else {
          throw err;
        }
      }
    };

    return { state, saveCreds: state.saveCreds };
  } catch (err) {
    if (err.code === "EPERM") {
      console.log("[Auth] EPERM on init, checking file permissions...");
      const credsPath = path.join(authFolder, "creds.json");
      try {
        if (fs.existsSync(credsPath)) {
          fs.chmodSync(credsPath, 0o666);
          console.log("[Auth] Fixed creds.json permissions");
        }
      } catch {}

      const { state, saveCreds } = await useMultiFileAuthState(authFolder);
      return { state, saveCreds };
    }
    throw err;
  }
}

module.exports = { initAuth };
