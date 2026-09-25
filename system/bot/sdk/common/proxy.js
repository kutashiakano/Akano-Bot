import fetch from "node-fetch";
import { getProxyUrl as sdkGetProxyUrl, normalizeProxyUrl as sdkNormalize, shouldProxy as sdkShouldProxy, getProxyAgent as sdkGetAgent } from "@kutashiakanocanzy/sdk";
function settingsProxy() {
  try {
    const s = global.settings;
    if (s && s.connection && s.connection.proxy) return s.connection.proxy;
    if (s && s.proxy) return s.proxy;
    if (global.proxy) return global.proxy;
  } catch {}
  return undefined;
}
function getProxyUrl() {
  return sdkGetProxyUrl({ proxy: settingsProxy() });
}
function getProxyAgent(targetUrl) {
  return sdkGetAgent(targetUrl || "https://web.whatsapp.com", { proxy: settingsProxy() });
}
function createProxyAgent(opts) {
  opts = opts || {};
  return getProxyAgent(opts.target || opts.url);
}
function getFetchAgent(targetUrl) {
  return getProxyAgent(targetUrl);
}
function proxyFetch(url, opts) {
  opts = opts || {};
  const agent = getProxyAgent(url);
  if (agent) opts.agent = agent;
  return fetch(url, opts);
}
export { getProxyUrl, sdkNormalize as normalizeProxyUrl, sdkShouldProxy as shouldProxy, getProxyAgent, createProxyAgent, getFetchAgent, proxyFetch };
export default {
  getProxyUrl: getProxyUrl,
  normalizeProxyUrl: sdkNormalize,
  shouldProxy: sdkShouldProxy,
  getProxyAgent: getProxyAgent,
  createProxyAgent: createProxyAgent,
  getFetchAgent: getFetchAgent,
  proxyFetch: proxyFetch
};
