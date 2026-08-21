const util = require("util");
const vm = require("vm");

const SAFE = {
  console,
  util,
  Buffer,
  Math,
  JSON,
  Date,
  RegExp,
  Promise,
  String,
  Number,
  Boolean,
  Array,
  Object,
  Error,
  Map,
  Set,
  WeakMap,
  WeakSet,
  Symbol,
  BigInt,
  setTimeout,
  setInterval,
  clearTimeout,
  clearInterval,
  setImmediate,
  clearImmediate,
  queueMicrotask,
  isNaN,
  isFinite,
  parseInt,
  parseFloat,
  encodeURI,
  encodeURIComponent,
  decodeURI,
  decodeURIComponent,
};

let handler = async (m, { sock }) => {
  let text = m.text.trim();
  let type = text[0];
  if (!["x", ">"].includes(type)) return;

  let command = text.slice(2).trim();
  if (!command) return;

  let { key } = await sock.sendMessage(m.chat, { text: "🕒 Processing..." }, { quoted: m });

  try {
    const ctx = vm.createContext(Object.assign({}, SAFE, { sock, m }));
    const body = type === "x" ? `(async () => { return ${command} })()` : `(async () => { ${command} })()`;
    const result = await vm.runInContext(body, ctx, { timeout: 5000, filename: "eval.js" });
    await sock.sendMessage(m.chat, { text: util.format(result), edit: key });
  } catch (e) {
    await sock.sendMessage(m.chat, { text: util.format(e), edit: key });
  }
};
const { define } = require("../../../plugin");

module.exports = define({
  name: new RegExp(),
  category: (["advanced"])[0] || "tools",
  help: ([">", "x"])[0] || "",
  customPrefix: /^[x>] /,
  rowner: true,
  reg: true,
  run: function (c) { return handler.apply(c.that, [c.m, c.props]); },
});
