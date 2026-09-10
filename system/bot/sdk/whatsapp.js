function wa() {
  return global.sock || null;
}

function ok() {
  return global.sock || null;
}

let _walib = null;

function walib() {
  if (!_walib) _walib = require("../whatsapp/lib");
  return _walib;
}

function Cooldown(...a) {
  try {
    return new (require("./common/cooldown").Cooldown)(...a);
  } catch (e) {
    return new (require("../whatsapp/lib/cooldown").Cooldown)(...a);
  }
}

function SpamDetection(...a) {
  try {
    return new (require("./common/cooldown").SpamDetection)(...a);
  } catch (e) {
    return new (require("../whatsapp/lib/cooldown").SpamDetection)(...a);
  }
}

function msgqueue() {
  return global.msgqueue || global.queue || null;
}

module.exports = {
  wa: wa,
  ok: ok,
  walib: walib,
  Cooldown: Cooldown,
  SpamDetection: SpamDetection,
  msgqueue: msgqueue
};
