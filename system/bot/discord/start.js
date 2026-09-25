import discord from "./index.js";

export default function startDiscord() {
  try {
    discord.initialize().catch(e => global.logError("DC_INIT", e));
  } catch (e) {
    global.logError("DC_INIT", e);
  }
}