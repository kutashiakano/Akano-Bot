import telegram from "./index.js";

export default function startTelegram() {
  try {
    telegram.initialize().catch(e => global.logError("TG_INIT", e));
  } catch (e) {
    global.logError("TG_INIT", e);
  }
}
