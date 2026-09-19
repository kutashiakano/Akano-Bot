function tg() {
  return global.telegramBot?.bot || global.telegramBot?.api || null;
}

function answerCb(ctx, text) {
  const msg = String(text == null ? "" : text).slice(0, 200);
  return ctx.answerCallbackQuery(msg).catch(() => {});
}

function grammy() {
  return require("grammy");
}

function inputFile(data, filename) {
  try {
    return new (grammy().InputFile)(data, filename);
  } catch (e) {
    throw new Error("grammy InputFile is not available");
  }
}

function cls(name) {
  try {
    return grammy()[name] || null;
  } catch {
    return null;
  }
}

function hydrate() {
  try {
    return require("@grammyjs/files").hydrateFiles || null;
  } catch {
    return null;
  }
}

function isConflictError(err) {
  try {
    const inner = err && err.error ? err.error : err;
    const G = grammy().GrammyError;
    if (G && inner instanceof G && inner.error_code === 409) return true;
  } catch {}
  const msg = String((err && err.error && err.error.message) || (err && err.message) || err || "");
  return /409|Conflict|terminated by other getUpdates/.test(msg);
}

function describeError(err) {
  let inner = err && err.error ? err.error : err;
  let kind = "unknown";
  try {
    const G = grammy();
    if (G.GrammyError && inner instanceof G.GrammyError) kind = "grammy";
    else if (G.HttpError && inner instanceof G.HttpError) kind = "http";
  } catch {}
  const message = String((inner && inner.description) || (inner && inner.message) || inner || "");
  const updateType = err && err.ctx ? err.ctx.updateType || (err.ctx.update && err.ctx.update.message ? "message" : "unknown") : "unknown";
  return { kind: kind, message: message, updateType: updateType, error: inner };
}

module.exports = {
  tg: tg,
  answerCb: answerCb,
  inputFile: inputFile,
  isConflictError: isConflictError,
  describeError: describeError
};

for (const key of ["Bot", "Api", "Composer", "session", "InlineKeyboard", "Keyboard", "InputMediaBuilder", "InputFile", "GrammyError", "HttpError", "BotError"]) {
  Object.defineProperty(module.exports, key, {
    enumerable: true,
    configurable: true,
    get: () => cls(key)
  });
}

Object.defineProperty(module.exports, "hydrateFiles", {
  enumerable: true,
  configurable: true,
  get: () => hydrate()
});
