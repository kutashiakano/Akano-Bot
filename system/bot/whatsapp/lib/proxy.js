const {URL: URL} = require("url");

function getProxyUrl() {
  const fromEnv = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || process.env.ALL_PROXY || process.env.all_proxy || null;
  if (fromEnv) return fromEnv;
  try {
    const s = global.settings;
    if (s && s.connection && s.connection.proxy) return s.connection.proxy;
    if (s && s.proxy) return s.proxy;
    if (global.proxy) return global.proxy;
  } catch {}
  return null;
}

function parseNoProxy() {
  const raw = process.env.NO_PROXY || process.env.no_proxy || "";
  if (!raw) return [];
  return raw.split(",").map(s => s.trim()).filter(Boolean);
}

function shouldProxy(targetUrl) {
  const list = parseNoProxy();
  if (list.length === 0) return true;
  let host = "";
  try {
    host = new URL(targetUrl).hostname.toLowerCase();
  } catch {
    host = String(targetUrl).toLowerCase();
  }
  const targetWithDots = `.${host}`;
  for (const entryRaw of list) {
    const entry = entryRaw.toLowerCase().trim();
    if (!entry) continue;
    if (entry === "*") return false;
    if (entry.startsWith(".")) {
      if (host === entry.slice(1) || targetWithDots.endsWith(entry)) return false;
    } else if (host === entry) {
      return false;
    } else if (targetWithDots.endsWith(`.${entry}`)) {
      return false;
    } else if (host.includes(entry)) {
      return false;
    }
    if (entry.includes("*")) {
      const re = new RegExp(`^${entry.replace(/\./g, "\\.").replace(/\*/g, ".*")}$`);
      if (re.test(host)) return false;
    }
  }
  return true;
}

function normalizeProxyUrl(url) {
  if (!url) return null;
  let u = String(url).trim();
  if (!u) return null;
  if (!/^\w+:\/\//.test(u)) u = `http://${u}`;
  try {
    new URL(u);
    return u;
  } catch {
    return null;
  }
}

function getProxyAgent(targetUrl = "https://web.whatsapp.com") {
  const raw = getProxyUrl();
  const proxyUrl = normalizeProxyUrl(raw);
  if (!proxyUrl) return undefined;
  const waHosts = [ "web.whatsapp.com", "whatsapp.net", "whatsapp.com", ".whatsapp.net" ];
  const isWa = waHosts.some(h => {
    if (h.startsWith(".")) return targetUrl.includes(h) || new URL(targetUrl).hostname.endsWith(h);
    return targetUrl.includes(h);
  });
  if (isWa) {
    const noProxy = parseNoProxy();
    const waInNoProxy = noProxy.some(p => p.toLowerCase().includes("whatsapp"));
    if (waInNoProxy && !shouldProxy(targetUrl)) return undefined;
    if (!shouldProxy(targetUrl)) return undefined;
  } else {
    if (!shouldProxy(targetUrl)) return undefined;
  }
  try {
    const {HttpsProxyAgent: HttpsProxyAgent} = require("https-proxy-agent");
    return new HttpsProxyAgent(proxyUrl);
  } catch (e) {
    try {
      const {HttpProxyAgent: HttpProxyAgent} = require("https-proxy-agent");
      return new HttpProxyAgent(proxyUrl);
    } catch {}
    console.warn(`[Proxy] https-proxy-agent not available: ${e.message}`);
    return undefined;
  }
}

function createProxyAgent(opts = {}) {
  const target = opts.target || opts.url || "https://web.whatsapp.com";
  return getProxyAgent(target);
}

function getFetchAgent(targetUrl) {
  return getProxyAgent(targetUrl);
}

function proxyFetch(url, opts = {}) {
  const agent = getProxyAgent(url);
  if (agent) {
    opts.agent = agent;
  }
  const fetch = require("node-fetch");
  return fetch(url, opts);
}

module.exports = {
  getProxyUrl: getProxyUrl,
  normalizeProxyUrl: normalizeProxyUrl,
  shouldProxy: shouldProxy,
  getProxyAgent: getProxyAgent,
  createProxyAgent: createProxyAgent,
  getFetchAgent: getFetchAgent,
  proxyFetch: proxyFetch
};