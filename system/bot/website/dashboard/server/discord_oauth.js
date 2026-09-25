import crypto from "crypto";
import tunnel from "./tunnel.js";
import auth from "./auth.js";
import store from "./store.js";
import database from "../../../../database/index.js";
const states = new Map;
function clientId() {
  try {
    return global.discordBot && global.discordBot.client && global.discordBot.client.user ? global.discordBot.client.user.id : null;
  } catch (e) {
    return null;
  }
}
function clientSecret() {
  try {
    const s = (global.settings && global.settings.discord && global.settings.discord.clientSecret) || process.env.DISCORD_CLIENT_SECRET || "";
    const t = String(s || "").trim();
    if (!t || t.indexOf("your_") === 0 || t.indexOf("${") !== -1) return null;
    return t;
  } catch (e) {
    return null;
  }
}
function baseUrl(req) {
  try {
    const st = tunnel.getStatus();
    if (st.tunnelUrl) return String(st.tunnelUrl).replace(/\/$/, "");
    if (st.staticUrl) return String(st.staticUrl).replace(/\/$/, "");
  } catch (e) {}
  try {
    const host = req.headers["x-forwarded-host"] || req.headers.host || "127.0.0.1:3001";
    const proto = (req.headers["x-forwarded-proto"] || "http").split(",")[0];
    return proto + "://" + host;
  } catch (e) {
    return "http://127.0.0.1:3001";
  }
}
function configured(req) {
  return !!(clientId() && clientSecret() && baseUrl(req).indexOf("https://") === 0);
}
function redirectUri(req) {
  return baseUrl(req) + "/api/auth/discord/callback";
}
async function status(req, res, sendJson) {
  const cid = clientId();
  const ok = configured(req);
  return sendJson(res, 200, { ok: true, configured: ok, clientId: ok ? cid : null, redirectUri: ok ? redirectUri(req) : null });
}
async function start(req, res) {
  if (!configured(req)) {
    res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ ok: false, message: "Discord login is not configured. Set the client secret and use a public https URL." }));
    return true;
  }
  const state = crypto.randomBytes(16).toString("hex");
  states.set(state, Date.now() + 600000);
  if (states.size > 200) {
    const now = Date.now();
    for (const [k, v] of states) if (v < now) states.delete(k);
  }
  const q = new URLSearchParams({ client_id: clientId(), redirect_uri: redirectUri(req), response_type: "code", scope: "identify", state: state, prompt: "none" });
  res.writeHead(302, { Location: "https://discord.com/oauth2/authorize?" + q.toString() });
  res.end();
  return true;
}
async function postForm(url, params, timeoutMs) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs || 15000);
  try {
    const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params).toString(), signal: ctl.signal });
    return await r.json().catch(() => ({}));
  } finally {
    clearTimeout(t);
  }
}
async function getJson(url, token, timeoutMs) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs || 15000);
  try {
    const r = await fetch(url, { headers: { Authorization: "Bearer " + token, "User-Agent": "Akano-Bot" }, signal: ctl.signal });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch (e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}
function fail(res, reason) {
  res.writeHead(302, { Location: "/?oauth=" + encodeURIComponent(reason) });
  res.end();
}
async function callback(req, res, url, sendJson) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  if (err) return fail(res, "denied"), true;
  if (!code || !state || !states.has(state)) return fail(res, "invalid"), true;
  states.delete(state);
  if (!configured(req)) return fail(res, "unconfigured"), true;
  let authMod;
  try {
    authMod = auth;
  } catch (e) {
    return fail(res, "error"), true;
  }
  const tok = await postForm("https://discord.com/api/oauth2/token", { client_id: clientId(), client_secret: clientSecret(), grant_type: "authorization_code", code: code, redirect_uri: redirectUri(req) }).catch(() => null);
  if (!tok || !tok.access_token) return fail(res, "exchange"), true;
  const du = await getJson("https://discord.com/api/v10/users/@me", tok.access_token);
  if (!du || !du.id) return fail(res, "profile"), true;
  try {
    const db = database.get();
    if (!db.discord) db.discord = { servers: {}, users: {} };
    if (!db.discord.users) db.discord.users = {};
    const id = String(du.id);
    const cur = db.discord.users[id] && typeof db.discord.users[id] === "object" ? db.discord.users[id] : {};
    const avatar = du.avatar ? "https://cdn.discordapp.com/avatars/" + id + "/" + du.avatar + ".png?size=256" : "";
    db.discord.users[id] = Object.assign({}, cur, { name: du.global_name || du.username || cur.name || "", username: du.username || cur.username || "", avatar: avatar || cur.avatar || "", registered: true, oauthLinkedAt: Date.now() });
    await database.write(db).catch(() => {});
  } catch (e) {
    try { if (global.logError) global.logError("discord.oauth.save", e); } catch (e2) {}
  }
  try {
    store.audit("discord-login", "ok", du.id);
  } catch (e) {}
  const token = authMod.createSession();
  res.writeHead(302, { Location: "/?oauth=ok", "Set-Cookie": "akano_dash=" + token + "; HttpOnly; SameSite=Lax; Path=/; Max-Age=" + 12 * 3600 });
  res.end();
  return true;
}
async function route(req, res, url, sendJson) {
  const p = url.pathname;
  if (p === "/api/auth/discord/status" && req.method === "GET") return status(req, res, sendJson), true;
  if (p === "/api/auth/discord" && req.method === "GET") return start(req, res);
  if (p === "/api/auth/discord/callback" && req.method === "GET") return callback(req, res, url, sendJson);
  return false;
}
export { route, status, configured };
export default { route: route, status: status, configured: configured };
