import https from "https";
import fs from "fs";
import path from "path";

const sessions = new Map;

const SESSION_FILE = path.join(import.meta.dirname, "../../../tmp/pollinations_sessions.json");
const MODELS_CACHE_FILE = path.join(import.meta.dirname, "../../../tmp/pollinations_models.json");

const UA = "Akano-Bot";
const DEFAULT_MODEL = "openai";
const HISTORY_LIMIT = 10;

const FALLBACK_MODELS = ["openai"];

const ALIASES = {
  gpt: "openai",
  oss: "openai",
  fast: "openai"
};

function loadSessions() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
      for (const [key, value] of Object.entries(data)) sessions.set(key, value);
    }
  } catch (e) {}
}

function saveSessions() {
  try {
    const dir = path.dirname(SESSION_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify(Object.fromEntries(sessions)));
  } catch (e) {}
}

loadSessions();

function req(url, body, timeout) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = typeof body === "string" ? body : JSON.stringify(body);
    const r = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: "POST",
      headers: {
        "User-Agent": UA,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload)
      },
      timeout: timeout || 90000
    }, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    r.on("error", reject);
    r.on("timeout", () => { r.destroy(new Error("request timeout")); });
    r.write(payload);
    r.end();
  });
}

function reqGet(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const r = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: "GET",
      headers: { "User-Agent": UA },
      timeout: 20000
    }, res => {
      const chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", reject);
    });
    r.on("error", reject);
    r.on("timeout", () => { r.destroy(new Error("request timeout")); });
    r.end();
  });
}

let modelCache = null;

async function listModels(force) {
  if (modelCache && !force) return modelCache;
  try {
    if (!force && fs.existsSync(MODELS_CACHE_FILE)) {
      const cached = JSON.parse(fs.readFileSync(MODELS_CACHE_FILE, "utf8"));
      if (cached && Date.now() - cached.ts < 86400000 && Array.isArray(cached.models) && cached.models.length) {
        modelCache = cached.models;
        return modelCache;
      }
    }
  } catch (e) {}
  try {
    const r = await reqGet("https://text.pollinations.ai/models");
    const j = JSON.parse(r.body);
    const ids = (Array.isArray(j) ? j : []).map(m => m.name).filter(Boolean);
    if (ids.length) {
      modelCache = ids;
      try { fs.writeFileSync(MODELS_CACHE_FILE, JSON.stringify({ ts: Date.now(), models: ids })); } catch (e) {}
      return modelCache;
    }
  } catch (e) {}
  modelCache = FALLBACK_MODELS.slice();
  return modelCache;
}

function resolveModel(name) {
  const q = String(name || "").trim().toLowerCase();
  if (!q) return DEFAULT_MODEL;
  if (ALIASES[q]) return ALIASES[q];
  const known = modelCache || FALLBACK_MODELS;
  const hit = known.find(m => String(m).toLowerCase() === q);
  return hit || DEFAULT_MODEL;
}

function getSettings(userId) {
  const s = userId ? sessions.get(String(userId)) : null;
  return {
    model: (s && s.model) || DEFAULT_MODEL,
    system: (s && s.system) || ""
  };
}

function setModel(userId, name) {
  const id = resolveModel(name);
  const key = String(userId);
  const s = sessions.get(key) || {};
  s.model = id;
  sessions.set(key, s);
  saveSessions();
  return id;
}

function setSystem(userId, text) {
  const key = String(userId);
  const s = sessions.get(key) || {};
  s.system = String(text || "").slice(0, 2000);
  sessions.set(key, s);
  saveSessions();
  return s.system;
}

function clearSession(userId) {
  if (!userId) return;
  sessions.delete(String(userId));
  saveSessions();
}

async function chat(prompt, userId = null, onChunk = null, options = {}) {
  const text = String(prompt == null ? "" : prompt).trim();
  if (!text) throw new Error("Empty prompt.");
  const key = userId ? String(userId) : null;
  const stored = key ? sessions.get(key) || {} : {};
  const model = resolveModel((options && options.model) || stored.model);
  const system = String((options && options.system !== undefined ? options.system : stored.system) || "");
  const history = Array.isArray(stored.history) ? stored.history.slice(-HISTORY_LIMIT) : [];
  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  for (const h of history) {
    if (h && (h.role === "user" || h.role === "assistant") && h.content) messages.push({ role: h.role, content: String(h.content).slice(0, 4000) });
  }
  messages.push({ role: "user", content: text.slice(0, 4000) });
  let r = null;
  try {
    r = await req("https://text.pollinations.ai/openai", { model: model, messages: messages }, 90000);
  } catch (e) {
    throw new Error("Pollinations request failed: " + e.message);
  }
  if (r.status !== 200) throw new Error("Pollinations chat failed (status " + r.status + ").");
  let acc = "";
  try {
    const j = JSON.parse(r.body);
    acc = String((j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || "");
  } catch (e) {
    throw new Error("Pollinations returned an unreadable reply.");
  }
  if (!acc.trim()) throw new Error("Pollinations returned an empty reply.");
  if (onChunk) onChunk(acc);
  if (key) {
    history.push({ role: "user", content: text.slice(0, 1000) });
    history.push({ role: "assistant", content: acc.slice(0, 1000) });
    sessions.set(key, Object.assign({}, stored, { model: model, system: system, history: history.slice(-HISTORY_LIMIT) }));
    saveSessions();
  }
  return { text: acc, model: model };
}

export { chat, listModels, resolveModel, getSettings, setModel, setSystem, clearSession, ALIASES, DEFAULT_MODEL };
export default {
  chat: chat,
  listModels: listModels,
  resolveModel: resolveModel,
  getSettings: getSettings,
  setModel: setModel,
  setSystem: setSystem,
  clearSession: clearSession,
  ALIASES: ALIASES,
  DEFAULT_MODEL: DEFAULT_MODEL
};
