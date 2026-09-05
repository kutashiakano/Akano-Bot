const {useMultiFileAuthState: useMultiFileAuthState} = require("baileys");
const fs = require("fs");
const path = require("path");

async function initAuth(authFolder, opts = {}) {
  const {proxy: proxy} = opts;
  try {
    const {state: state, saveCreds: saveCreds} = await useMultiFileAuthState(authFolder);
    const origSave = saveCreds;
    const wrappedSave = async () => {
      try {
        await origSave();
      } catch (err) {
        if (err && (err.code === "EPERM" || err.code === "EBUSY" || err.code === "ENOTEMPTY")) {
          console.log(`[Adapter] ${err.code} on saveCreds, retrying in 1s...`);
          await new Promise(r => setTimeout(r, 1e3));
          try {
            await origSave();
          } catch (retryErr) {
            console.error(`[Adapter] Retry failed: ${retryErr.message}`);
          }
        } else {
          throw err;
        }
      }
    };
    state.saveCreds = wrappedSave;
    return {
      state: state,
      saveCreds: wrappedSave
    };
  } catch (err) {
    if (err && err.code === "EPERM") {
      console.log("[Adapter] EPERM on init, fixing permissions...");
      const credsPath = path.join(authFolder, "creds.json");
      try {
        if (fs.existsSync(credsPath)) {
          fs.chmodSync(credsPath, 438);
          console.log("[Adapter] Fixed creds.json permissions");
        }
      } catch {}
      const {state: state, saveCreds: saveCreds} = await useMultiFileAuthState(authFolder);
      return {
        state: state,
        saveCreds: saveCreds
      };
    }
    throw err;
  }
}

async function useAdapterAuthState(authFolder, opts = {}) {
  return initAuth(authFolder, opts);
}

function createAdapter(opts = {}) {
  return {
    initAuth: folder => initAuth(folder, opts),
    useAdapterAuthState: folder => useAdapterAuthState(folder, opts),
    proxy: opts.proxy || null
  };
}

module.exports = {
  initAuth: initAuth,
  useAdapterAuthState: useAdapterAuthState,
  createAdapter: createAdapter,
  useMultiFileAuthState: useMultiFileAuthState
};