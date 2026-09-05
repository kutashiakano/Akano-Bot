const crypto = require("crypto");

const SESSIONS = new Map;

const ATTEMPTS = new Map;

const SESSION_TTL = 12 * 60 * 60 * 1e3;

const MAX_ATTEMPTS = 8;

const WINDOW = 10 * 60 * 1e3;

function clientIp(req) {
  return (req.socket.remoteAddress || "unknown").replace("::ffff:", "");
}

function rateLimited(ip) {
  const now = Date.now();
  const rec = ATTEMPTS.get(ip) || {
    count: 0,
    since: now
  };
  if (now - rec.since > WINDOW) {
    rec.count = 0;
    rec.since = now;
  }
  rec.count += 1;
  ATTEMPTS.set(ip, rec);
  if (rec.count > MAX_ATTEMPTS * 3) return true;
  return false;
}

function tooManyLogins(ip) {
  const now = Date.now();
  const rec = ATTEMPTS.get(ip);
  if (!rec) return false;
  return rec.failStreak >= MAX_ATTEMPTS && now - rec.since < WINDOW;
}

function recordLoginResult(ip, ok) {
  const now = Date.now();
  const rec = ATTEMPTS.get(ip) || {
    count: 0,
    since: now
  };
  if (now - rec.since > WINDOW) {
    rec.failStreak = 0;
    rec.since = now;
  }
  if (ok) rec.failStreak = 0; else rec.failStreak = (rec.failStreak || 0) + 1;
  ATTEMPTS.set(ip, rec);
}

function createSession() {
  const token = crypto.randomBytes(32).toString("hex");
  SESSIONS.set(token, {
    created: Date.now(),
    expires: Date.now() + SESSION_TTL
  });
  return token;
}

function validSession(token) {
  if (!token) return false;
  const s = SESSIONS.get(token);
  if (!s) return false;
  if (Date.now() > s.expires) {
    SESSIONS.delete(token);
    return false;
  }
  s.expires = Date.now() + SESSION_TTL;
  return true;
}

function destroySession(token) {
  if (token) SESSIONS.delete(token);
}

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function sessionFromReq(req) {
  const cookies = parseCookies(req);
  return cookies.akano_dash || null;
}

function isAuthed(req) {
  return validSession(sessionFromReq(req));
}

function isAuthedToken(token) {
  return validSession(token);
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of SESSIONS) if (v.expires < now) SESSIONS.delete(k);
}, 60 * 1e3).unref();

module.exports = {
  clientIp: clientIp,
  rateLimited: rateLimited,
  tooManyLogins: tooManyLogins,
  recordLoginResult: recordLoginResult,
  createSession: createSession,
  validSession: validSession,
  destroySession: destroySession,
  parseCookies: parseCookies,
  sessionFromReq: sessionFromReq,
  isAuthed: isAuthed,
  isAuthedToken: isAuthedToken
};