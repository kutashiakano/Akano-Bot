function tg() {
  return global.telegramBot?.bot || global.telegramBot?.api || null;
}

function answerCb(ctx, text) {
  return ctx.answerCallbackQuery(text).catch(() => {});
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

module.exports = {
  tg: tg,
  answerCb: answerCb,
  inputFile: inputFile
};

for (const key of ["Bot", "session", "InlineKeyboard", "Keyboard", "InputMediaBuilder", "InputFile", "GrammyError", "HttpError"]) {
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
